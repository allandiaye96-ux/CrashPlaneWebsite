param(
  [string]$JsonPath = "data/accidents.json",
  [string]$OutDir = "accidents",
  [string]$BaseUrl = "https://www.crashplanewebsite.com", [switch]$WithEnglish = $true
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-Prop($obj, [string]$name) {
  if ($null -eq $obj) { return $null }
  $p = $obj.PSObject.Properties.Match($name)
  if ($p -and $p.Count -gt 0) { return $p[0].Value } else { return $null }
}

function Truncate-Text([string]$text, [int]$len = 180) {
  if (-not $text) { return '' }
  $clean = ($text -replace '<[^>]+>', ' ') -replace '\s+', ' '
  if ($clean.Length -le $len) { return $clean.Trim() }
  return ($clean.Substring(0, $len).Trim() + '…')
}

function Make-Page { param([pscustomobject]$acc,[string]$dir,[string]$lang = 'fr') $id = $acc.id
  $title = if($lang -eq 'en' -and (Get-Prop $acc 'title_en')){ (Get-Prop $acc 'title_en') } else { $acc.title }
  $date = Get-Prop $acc 'date'
  $location = if($lang -eq 'en' -and (Get-Prop $acc 'location_en')){ (Get-Prop $acc 'location_en') } else { Get-Prop $acc 'location' }
  $aircraft = if($lang -eq 'en' -and (Get-Prop $acc 'aircraft_en')){ (Get-Prop $acc 'aircraft_en') } else { Get-Prop $acc 'aircraft' }
  $airline = if($lang -eq 'en' -and (Get-Prop $acc 'airline_en')){ (Get-Prop $acc 'airline_en') } else { Get-Prop $acc 'airline' }
  $country = Get-Prop $acc 'country'
  $passengers = Get-Prop $acc 'passengersTotal'
  $fatalities = Get-Prop $acc 'fatalities'
  $descHtml = if($lang -eq 'en' -and (Get-Prop $acc 'description_en')){ [string](Get-Prop $acc 'description_en') } else { [string](Get-Prop $acc 'description') }
  $img = $null
  $imgs = Get-Prop $acc 'images'
  $imgsArr = @($imgs)
  if ($imgsArr.Count -gt 0) {
    $first = $imgsArr[0]
    $firstUrl = Get-Prop $first 'url'
    if ($firstUrl) { $img = [string]$firstUrl }
  }
  $metaDesc = Truncate-Text $descHtml 200
  $basePath = if($lang -eq 'en'){ '/en/accidents' } else { '/accidents' }; $canonical = "$BaseUrl$basePath/$id/"
  $absImg = if ($img) { "$BaseUrl/$img" } else { "$BaseUrl/assets/img/plane.jpg" }

  $srcItems = @(Get-Prop $acc 'sources') | Where-Object { $_ -and (Get-Prop $_ 'url') } | ForEach-Object {
    $u = [System.Net.WebUtility]::HtmlEncode([string](Get-Prop $_ 'url'))
    $t = Get-Prop $_ 'title'; if (-not $t) { $t = Get-Prop $_ 'url' }
    "<li><a href=`"$u`" target=`"_blank`" rel=`"noopener`">$([System.Net.WebUtility]::HtmlEncode([string]$t))</a></li>"
  }
  $sourcesHtml = if ($srcItems) { "<section class=`"sources`"><h2>Sources</h2><ul>$($srcItems -join '')</ul></section>" } else { '' }

  $hero = if ($img) { "<img class=`"hero`" src=`"../../$img`" alt=`"$title`" />" } else { '' }

  $html = @"
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>$title</title>
    <meta name="description" content="$metaDesc" />
    <link rel="canonical" href="$canonical" />
    <meta property="og:title" content="$title" />
    <meta property="og:description" content="$metaDesc" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="$canonical" />
    <meta property="og:image" content="$absImg" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="/assets/img/plane.jpg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=B612:wght@400;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" />
    <script>try{document.documentElement.dataset.theme=localStorage.getItem('theme')||'dark'}catch(e){document.documentElement.dataset.theme='dark'}</script>
    <link rel="stylesheet" href="/assets/css/styles.css" />
  </head>
  <body>
    <header class="site-header">
      <div class="wrap header-inner">
        <a class="brand" href="/"><svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><defs><clipPath id="brandClip"><circle cx="16" cy="16" r="13"/></clipPath></defs><g clip-path="url(#brandClip)"><g transform="rotate(-14 16 16)"><rect class="sky" x="-4" y="-4" width="40" height="21"/><rect class="ground" x="-4" y="17" width="40" height="20"/></g></g><circle class="ring" cx="16" cy="16" r="13"/><path class="wings" d="M7 16.5h6l3 3 3-3h6"/></svg><span>Carnet de Vol</span></a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav">Menu</button>
        <nav id="nav" class="nav" aria-label="Navigation principale">
          <a href="/actualites/">Actualités</a>
          <a href="/#/base" aria-current="page">Accidents</a>
          <a href="/#/a-propos">À propos</a>
          <button id="themeToggle" class="theme-toggle" type="button">Mode jour</button>
        </nav>
      </div>
    </header>
    <main class="article" id="content">
      <a class="back" href="/">← Retour à l’accueil</a>
      <h1>$title</h1>
      <div class="meta">$date — $location — $airline — $aircraft</div>
      $hero
      <article class="story">$descHtml</article>
      $sourcesHtml
      <p><a class="btn" href="/#/accident/$id">Voir la fiche interactive</a></p>
    </main>
    <footer class="site-footer">
      <div class="wrap">
        <p>Projet personnel et pédagogique. Les récits résument des rapports d’enquête officiels ; référez-vous aux sources citées sur chaque fiche.</p>
        <p>Carnet de Vol — crashplanewebsite.com</p>
      </div>
    </footer>
    <script src="/assets/js/site.js"></script>
  </body>
</html>
"@

  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  Set-Content -Path (Join-Path $dir 'index.html') -Value $html -Encoding UTF8
}

Write-Host "Lecture du JSON: $JsonPath"
$raw = Get-Content -Raw -Encoding UTF8 $JsonPath
$data = $raw | ConvertFrom-Json
if (-not $data) { throw "Aucune donnée" }

Write-Host ("Accidents: {0}" -f $data.Count)

foreach ($acc in $data) {
  if (-not $acc.id) { continue }
  $dir = Join-Path $OutDir $acc.id
  Make-Page -acc $acc -dir $dir
}

# Génère un index minimal des accidents
$links = ($data | ForEach-Object { "<li><a href=`"/accidents/$($_.id)/`">$($_.title)</a></li>" }) -join "`n"
$listHtml = @"
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Accidents — Carnet de Vol</title>
  <link rel="canonical" href="$BaseUrl/accidents/" />
  <meta property="og:title" content="Accidents — Carnet de Vol" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="$BaseUrl/accidents/" />
  <link rel="icon" href="../assets/img/plane.jpg" />
  <link rel="stylesheet" href="../assets/css/styles.css" />
  <style>.list{max-width:900px;margin:2rem auto;padding:0 1rem}</style>
</head>
<body>
  <header class="site-header"><div class="container header-inner"><a class="brand" href="/">✈ Carnet de Vol</a></div></header>
  <main class="list"><h1>Accidents</h1><ul>$links</ul></main>
  <footer class="site-footer"><div class="container"><p>Carnet de Vol — crashplanewebsite.com</p></div></footer>
</body>
</html>
"@
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Set-Content -Path (Join-Path $OutDir 'index.html') -Value $listHtml -Encoding UTF8

# Met à jour sitemap.xml
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('<?xml version="1.0" encoding="UTF-8"?>')
[void]$sb.AppendLine('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
[void]$sb.AppendLine("  <url><loc>$BaseUrl/</loc></url>")
[void]$sb.AppendLine("  <url><loc>$BaseUrl/accidents/</loc></url>")
[void]$sb.AppendLine("  <url><loc>$BaseUrl/actualites/</loc></url>")
foreach ($acc in $data) {
  if (-not $acc.id) { continue }
  [void]$sb.AppendLine("  <url><loc>$BaseUrl/accidents/$($acc.id)/</loc></url>")
}
[void]$sb.AppendLine('</urlset>')

Set-Content -Path 'sitemap.xml' -Value $sb.ToString() -Encoding UTF8

Write-Host "Pages statiques générées dans '$OutDir' et sitemap.xml mis à jour."







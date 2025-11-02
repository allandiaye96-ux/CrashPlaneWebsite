$ErrorActionPreference = 'Stop'

# Synchronise window.__ACCIDENTS_FALLBACK dans index.html avec data/accidents.json
$repoRoot = Split-Path -Parent $PSScriptRoot
$jsonPath = Join-Path $repoRoot 'data\accidents.json'
$htmlPath = Join-Path $repoRoot 'index.html'

if (!(Test-Path $jsonPath)) { Write-Error "Introuvable: $jsonPath" }
if (!(Test-Path $htmlPath)) { Write-Error "Introuvable: $htmlPath" }

$jsonRaw = Get-Content -Raw -Encoding UTF8 $jsonPath
try { $obj = $jsonRaw | ConvertFrom-Json } catch { Write-Error "JSON invalide: $($_.Exception.Message)" }
$pretty = $obj | ConvertTo-Json -Depth 64

$html = Get-Content -Raw -Encoding UTF8 $htmlPath
$assign = "window.__ACCIDENTS_FALLBACK = " + $pretty + ";"
$pattern = 'window.__ACCIDENTS_FALLBACK\s*=\s*\[[\s\S]*?\];'
if ($html -match $pattern) {
  $newHtml = [regex]::Replace($html, $pattern, $assign)
  Set-Content -Path $htmlPath -Value $newHtml -Encoding UTF8
  Write-Host "Fallback synchronisé à partir de data/accidents.json" -ForegroundColor Green
} else {
  Write-Warning "Bloc window.__ACCIDENTS_FALLBACK introuvable dans index.html"
}


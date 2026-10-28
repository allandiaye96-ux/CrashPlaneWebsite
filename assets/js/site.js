/* Éléments communs à toutes les pages : thème jour/nuit et menu mobile. */
(function () {
  'use strict';
  var root = document.documentElement;
  function current() { return root.dataset.theme === 'light' ? 'light' : 'dark'; }
  function label(btn) {
    var dark = current() === 'dark';
    btn.textContent = dark ? 'Mode jour' : 'Mode nuit';
    btn.setAttribute('aria-pressed', dark ? 'false' : 'true');
  }
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('themeToggle');
    if (btn) {
      label(btn);
      btn.addEventListener('click', function () {
        root.dataset.theme = current() === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
        label(btn);
        document.dispatchEvent(new Event('themechange'));
      });
    }
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.getElementById('nav');
    if (toggle && nav) {
      toggle.addEventListener('click', function () {
        var open = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
        nav.classList.toggle('is-open', !open);
      });
      nav.addEventListener('click', function (e) {
        if (e.target.tagName === 'A') { toggle.setAttribute('aria-expanded', 'false'); nav.classList.remove('is-open'); }
      });
    }
  });
})();

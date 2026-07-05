// theme.js — Bascule clair/sombre GLOBALE, persistée, branchée sur toutes les pages.
// Applique data-theme sur <html> (avant le rendu), injecte un bouton flottant 🌙/☀️.
(function () {
  var KEY = 'asrar_theme';
  var root = document.documentElement;

  function label() { return root.getAttribute('data-theme') === 'light' ? '☀️' : '🌙'; }
  function apply(t) {
    root.setAttribute('data-theme', t === 'light' ? 'light' : 'dark');
    var b = document.getElementById('asrarThemeBtn');
    if (b) b.textContent = label();
  }

  var theme = 'dark';
  try { theme = localStorage.getItem(KEY) || 'dark'; } catch (e) {}
  apply(theme);

  window.asrarToggleTheme = function () {
    var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    apply(next);
    try { localStorage.setItem(KEY, next); } catch (e) {}
  };

  function injectBtn() {
    if (document.getElementById('asrarThemeBtn')) return;
    var b = document.createElement('button');
    b.id = 'asrarThemeBtn';
    b.type = 'button';
    b.setAttribute('aria-label', 'Basculer clair / sombre');
    b.textContent = label();
    b.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:99999;width:46px;height:46px;' +
      'border-radius:50%;border:1px solid rgba(150,150,150,.4);background:rgba(40,40,45,.85);' +
      'color:#f5e6c4;font-size:1.2rem;cursor:pointer;backdrop-filter:blur(6px);' +
      'box-shadow:0 4px 14px rgba(0,0,0,.3);';
    b.onclick = window.asrarToggleTheme;
    document.body.appendChild(b);
  }
  if (document.body) injectBtn();
  else document.addEventListener('DOMContentLoaded', injectBtn);
})();

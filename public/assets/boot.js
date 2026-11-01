(function () {
  'use strict';

  var KEY = 'lumen.tools.theme';
  var theme = 'dark';
  try {
    var saved = window.localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') theme = saved;
  } catch (error) {
    theme = 'dark';
  }

  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;

  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#F2EFE7' : '#07060C');
})();

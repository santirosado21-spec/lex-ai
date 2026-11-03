// Applies the saved appearance before first paint. Loaded synchronously from <head>; CSP forbids inline scripts.
try {
  const theme = localStorage.getItem('lex-ai.appearance');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch {}

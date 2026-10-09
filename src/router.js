const mode = new URLSearchParams(window.location.search).get('mode');
if (mode === 'space') await import('./space-main.js');
else await import('./main.js');

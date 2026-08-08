(() => {
  const progress = document.querySelector('[data-reading-progress]');
  if (!progress) return;

  function refreshProgress() {
    const root = document.documentElement;
    const range = root.scrollHeight - root.clientHeight;
    const position = root.scrollTop || document.body.scrollTop || 0;
    const percent = range > 0 ? Math.min(100, Math.max(0, (position / range) * 100)) : 0;
    progress.style.setProperty('--reading-progress', `${percent.toFixed(2).replace(/\.00$/, '')}%`);
  }

  window.PyTorchReading = { refreshProgress };
  window.addEventListener('scroll', refreshProgress, { passive: true });
  window.addEventListener('resize', refreshProgress);
  refreshProgress();
})();

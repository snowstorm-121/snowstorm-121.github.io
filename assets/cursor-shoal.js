(() => {
  if (document.documentElement.dataset.moonScaleShoal !== "true") return;

  const syncSelectionState = () => {
    const selected = document.getSelection?.()?.toString() ?? "";
    if (selected) document.documentElement.dataset.orbitSelecting = "true";
    else delete document.documentElement.dataset.orbitSelecting;
  };

  document.addEventListener("selectionchange", syncSelectionState);
  window.addEventListener("pagehide", () => {
    delete document.documentElement.dataset.orbitSelecting;
  });
})();

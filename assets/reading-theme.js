(() => {
  const KEY = "snowstorm-reading-theme";
  const media = matchMedia("(prefers-color-scheme: dark)");
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch {}
  let choice = saved === "light" || saved === "dark" ? saved : null;
  const current = () => choice ?? (media.matches ? "dark" : "light");
  const apply = () => {
    const mode = current();
    document.documentElement.dataset.readingTheme = mode;
    if (!document.documentElement.hasAttribute("data-reading-home")) {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = mode === "light" ? "#f4f0e9" : "#0a1623";
    }
    document.querySelectorAll("[data-reading-theme-toggle]").forEach((button) => {
      button.dataset.mode = mode;
      button.setAttribute("aria-pressed", String(mode === "dark"));
      button.setAttribute("aria-label", mode === "dark"
        ? "阅读模式：夜间，切换为日间"
        : "阅读模式：日间，切换为夜间");
    });
  };
  apply();
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-reading-theme-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        choice = current() === "dark" ? "light" : "dark";
        try { localStorage.setItem(KEY, choice); } catch {}
        apply();
      });
    });
    apply();
  });
  media.addEventListener?.("change", () => { if (choice === null) apply(); });
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY) return;
    choice = event.newValue === "light" || event.newValue === "dark" ? event.newValue : null;
    apply();
  });
})();

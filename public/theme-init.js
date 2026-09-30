// Apply the saved Açık/Koyu/Sistem choice before first paint, so the page never flashes the wrong
// theme. Mirrors applyThemeMode() in src/lib/theme.ts. A file rather than an inline script, so the
// Content-Security-Policy can forbid inline scripts altogether.
(function () {
  var mode = "system";
  try {
    mode = localStorage.getItem("carlog:theme") || "system";
  } catch (e) {}
  var dark = mode === "dark" || (mode !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (dark) {
    document.documentElement.classList.add("dark");
    document.querySelector('meta[name="theme-color"]').setAttribute("content", "#020617");
  }
})();

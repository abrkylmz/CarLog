import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { DialogProvider } from "./components/DialogProvider";
// CarLog's own typeface, served with the app (the CSP allows no font hosts), so text looks the
// same on every device. Browsers fetch only the subsets a page uses (Latin + Turkish letters).
import "@fontsource-variable/plus-jakarta-sans/wght.css";
import "./index.css";

// Offline support and reminder notifications (see public/sw.js). Development runs without it
// so code changes always show up.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DialogProvider>
      <App />
    </DialogProvider>
  </React.StrictMode>,
);

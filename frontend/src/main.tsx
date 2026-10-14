import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

// Handle dynamic import chunk loading failures (e.g. after a new release is deployed)
window.addEventListener("vite:preloadError", (event) => {
  console.warn("Vite chunk preload error detected, refreshing page...", event);
  const lastReload = sessionStorage.getItem("last_preload_reload");
  const now = Date.now();
  if (!lastReload || now - Number(lastReload) > 10000) {
    sessionStorage.setItem("last_preload_reload", String(now));
    window.location.reload();
  }
});

async function enableMocking(): Promise<void> {
  if (import.meta.env.VITE_ENABLE_MOCK === "true") {
    const { worker } = await import("./shared/testing/browser");
    await worker.start({
      onUnhandledRequest: "bypass",
    });
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find the root element");
}

enableMocking().then(() => {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});

// Register PWA service worker in production environments
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => {
        console.warn("PWA ServiceWorker registration error:", err);
      });
  });
}

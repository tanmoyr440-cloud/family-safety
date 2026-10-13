import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

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


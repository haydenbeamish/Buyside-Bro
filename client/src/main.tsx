import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

Sentry.init({
  dsn: "https://0f3d6c61664b1d184575ae967055c2fb@o4510859440947200.ingest.us.sentry.io/4510859449466880",
  sendDefaultPii: true,
  enableLogs: true,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.2,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
});

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker for PWA support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Service worker registration failed silently
    });
  });
}

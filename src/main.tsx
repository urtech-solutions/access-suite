import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const canRegisterPwaWorker =
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  (window.isSecureContext ||
    ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname));

if (canRegisterPwaWorker) {
  navigator.serviceWorker.register("/push-sw.js").catch(() => undefined);
}

createRoot(document.getElementById("root")!).render(<App />);

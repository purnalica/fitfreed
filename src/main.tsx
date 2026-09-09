import React from "react";
import ReactDOM from "react-dom/client";
import "./Startup.css";
import { StartupRoot } from "./StartupRoot";

async function start() {
  if (import.meta.env.VITE_FITFREED_E2E === "true") {
    await import("@wdio/tauri-plugin");
  }

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <StartupRoot />
    </React.StrictMode>,
  );
}

void start();

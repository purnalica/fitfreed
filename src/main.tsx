import "./Startup.css";
import { bootstrapApplication } from "./startup-bootstrap";
import { claimApplicationStartup } from "./startup-claim";

async function start() {
  if (import.meta.env.VITE_FITFREED_E2E === "true") {
    await import("@wdio/tauri-plugin");
  }

  const root = document.getElementById("root");
  if (!root) throw new Error("FitFreed requires its application root");
  await bootstrapApplication(root);
}

if (import.meta.env.DEV || claimApplicationStartup(window)) void start();

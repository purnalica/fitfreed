import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./App.css";
import type { ApplicationStartup } from "./presentation/application-startup";

export function mountReactApplication(root: HTMLElement, startup: ApplicationStartup) {
  createRoot(root).render(
    <StrictMode>
      <App startup={startup} />
    </StrictMode>,
  );
}

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/source-sans-3/400.css";
import "@fontsource/source-sans-3/600.css";
import "@fontsource/source-sans-3/700.css";
import "@fontsource/literata/400.css";
import "@fontsource/literata/600.css";
import "@fontsource/literata/700.css";
import "@xyflow/react/dist/style.css";
import "./styles.css";
import { App } from "./App";
import { suppressBrowserContextMenu } from "./contextMenu";

suppressBrowserContextMenu(document);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

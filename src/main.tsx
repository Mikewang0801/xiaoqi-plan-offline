import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Home from "./App";
import "./app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Home />
  </StrictMode>,
);

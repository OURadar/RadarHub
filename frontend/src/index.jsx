import React from "react";
import { createRoot } from "react-dom/client";

import { App, Pathway } from "./components/app-intro";

let text = document.getElementById("params")?.textContent || "{}";
let params = JSON.parse(text);

const app = document.getElementById("app");
const appRoot = createRoot(app);
appRoot.render(<App {...params} />);

const pathway = document.getElementById("pathway");
const pathwayRoot = createRoot(pathway);
pathwayRoot.render(<Pathway {...params} />);

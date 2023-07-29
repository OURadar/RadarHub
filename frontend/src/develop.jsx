import React from "react";
import { createRoot } from "react-dom/client";

import { App } from "./components/app5";

const text = document.getElementById("params")?.textContent || "{}";
const params = JSON.parse(text);

const container = document.getElementById("app");
const root = createRoot(container);
root.render(<App {...params} />);

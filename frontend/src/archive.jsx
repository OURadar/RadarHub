import React from "react";
import { createRoot } from "react-dom/client";

import { App as AppX } from "./components/appX";

const text = document.getElementById("params")?.textContent || "{}";
const params = JSON.parse(text);

console.log("params", params);

const container = document.getElementById("app");
const root = createRoot(container);

root.render(<AppX {...params} />);

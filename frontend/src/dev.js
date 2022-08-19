import React from "react";
import { createRoot } from "react-dom/client";

// import { App as AppMobile } from "./components/app9.js";
import { App as AppMobile } from "./components/appX.js";
// import { App as AppMobile } from "./components/appZ.js";

let text = document.getElementById("params")?.textContent || "{}";
let params = JSON.parse(text);
console.log("params", params);

const container = document.getElementById("app");
const root = createRoot(container);
root.render(<AppMobile {...params} />);

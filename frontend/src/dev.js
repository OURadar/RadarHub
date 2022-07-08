import React from "react";
import { createRoot } from "react-dom/client";

// import App from "./components/app-glview";
// import App from "./components/app1";
// import App from "./components/app5";
import App from "./components/app9";

let text = document.getElementById("params")?.textContent || "{}";
let params = JSON.parse(text);

const container = document.getElementById("app");
const root = createRoot(container);
root.render(<App {...params} />);

import React from "react";
import { createRoot } from "react-dom/client";

// import App from "./components/app-glview";
// import App from "./components/app1";
// import App from "./components/app5";
import App from "./components/app6";

let params = {};
let o = document.getElementById("params");
if (o) {
  params = JSON.parse(o.textContent);
  console.log(params);
}

const container = document.getElementById("app");
const root = createRoot(container);
root.render(<App {...params} />);

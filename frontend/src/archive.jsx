import React from "react";
import { createRoot } from "react-dom/client";

import { detectMob } from "./components/common";

import { App as AppDesktop } from "./components/appX";
import { App as AppMobile } from "./components/appX";

const text = document.getElementById("params")?.textContent || "{}";
const params = JSON.parse(text);

console.log("params", params);

const container = document.getElementById("app");
const root = createRoot(container);

const mobile = detectMob() || window.innerWidth < 640;
if (mobile) {
  console.info("Using mobile ...");
  root.render(<AppMobile {...params} />);
} else {
  console.info("Using desktop ...");
  root.render(<AppDesktop {...params} />);
}

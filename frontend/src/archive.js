import React from "react";
import { createRoot } from "react-dom/client";

import { detectMob } from "./components/common";

import { App as AppDesktop } from "./components/app6";
import { App as AppMobile } from "./components/app9";

const text = document.getElementById("params")?.textContent || "{}";
const params = JSON.parse(text);

const container = document.getElementById("app");
const root = createRoot(container);

const mobile = detectMob();
if (mobile) {
  console.info("Using mobile ...");
  root.render(<AppMobile {...params} />);
} else {
  console.info("Using desktop ...");
  root.render(<AppDesktop {...params} />);
}

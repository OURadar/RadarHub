import React from "react";
import ReactDOM from "react-dom";
import App2 from "./components/app2";

const radar = JSON.parse(document.getElementById("radar-name").textContent);

ReactDOM.render(<App2 radar={radar} />, document.getElementById("app"));

import React from "react";
import ReactDOM from "react-dom";
import App from "./components/app";

const radar = JSON.parse(document.getElementById("radar-name").textContent);

ReactDOM.render(<App radar={radar} />, document.getElementById("app"));

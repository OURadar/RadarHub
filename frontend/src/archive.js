import React from "react";
import ReactDOM from "react-dom";
import Archive from "./components/archive";

const radar = JSON.parse(document.getElementById("radar-name").textContent);

ReactDOM.render(<Archive radar={radar} />, document.getElementById("app"));

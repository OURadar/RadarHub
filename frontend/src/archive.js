import React from "react";
import ReactDOM from "react-dom";
import App2 from "./components/app2";

const text = document.getElementById("params").textContent;
const params = JSON.parse(JSON.parse(text));

ReactDOM.render(<App2 {...params} />, document.getElementById("app"));

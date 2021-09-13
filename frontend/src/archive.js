import React from "react";
import ReactDOM from "react-dom";
import App3 from "./components/app3";

const text = document.getElementById("params").textContent;
const params = JSON.parse(text);

ReactDOM.render(<App3 {...params} />, document.getElementById("app"));

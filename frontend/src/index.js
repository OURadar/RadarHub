import React from "react";
import ReactDOM from "react-dom";
import App from "./components/app6";

const text = document.getElementById("params").textContent;
const params = JSON.parse(text);

ReactDOM.render(<App {...params} />, document.getElementById("app"));

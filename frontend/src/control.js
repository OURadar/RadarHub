import React from "react";
import ReactDOM from "react-dom";
import App from "./components/app5";

let params = {};
let o = document.getElementById("params");
if (o) {
  params = JSON.parse(o.textContent);
}

ReactDOM.render(<App {...params} />, document.getElementById("app"));

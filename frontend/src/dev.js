import React from "react";
import ReactDOM from "react-dom";
// import App from "./components/app1";
// import App from "./components/app5";
import App from "./components/app-glview";
// import App from "./components/app-dev";

const text = document.getElementById("params").textContent;
const params = JSON.parse(text);

ReactDOM.render(<App {...params} />, document.getElementById("app"));

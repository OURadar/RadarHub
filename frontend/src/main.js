import React from "react";
import ReactDOM from "react-dom";

// import App from "./components/app-glview";

// import App from "./components/app1";
// import App from "./components/app5";
import App from "./components/app6";

const text = document.getElementById("params").textContent;
const params = JSON.parse(text);

// console.log("dev.js");
// console.log(params);

ReactDOM.render(<App {...params} />, document.getElementById("app"));

import React from "react";
import ReactDOM from "react-dom";

// import App from "./components/app-glview";
// import App from "./components/app1";
// import App from "./components/app5";
import App from "./components/app6";

let params = {};
let o = document.getElementById("params");
if (o) {
  params = JSON.parse(o.textContent);
  console.log(params);
}

ReactDOM.render(<App {...params} />, document.getElementById("app"));

import React from "react";
import ReactDOM from "react-dom";
import App from "./components/app";

const radar = JSON.parse(document.getElementById("radar-name").textContent);
const receiver = JSON.parse(document.getElementById("receiver").textContent);

ReactDOM.render(
  <App radar={radar} receiver={receiver} />,
  document.getElementById("app")
);

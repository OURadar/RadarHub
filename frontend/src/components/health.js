//
//  health.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React from "react";

function styleFromEnum(x) {
  const enumStyle = ["-3", "-2", "-1", "normal", "ready", "alert", "old", ""];
  return enumStyle[x + 3];
}

function prettyString(input) {
  return input
    .replace(/(?:[\s])deg/g, "°")
    .replace(/degC/g, "°C")
    .replace(/degF/g, "°F");
}

function IndicatorLight(props) {
  let style = "ledValue " + styleFromEnum(props.value["Enum"]);
  return (
    <div className="ledIndicator">
      <div className={style}></div>
      <div className="ledTitle">{props.name}</div>
    </div>
  );
}

function IndicatorLabel(props) {
  let style = "labelValue " + styleFromEnum(props.value["Enum"]);
  let value = prettyString(props.value["Value"]);
  return (
    <div className="labelIndicator">
      <div className={style}>{value}</div>
      <div className="labelTitle">{props.name}</div>
    </div>
  );
}

function Health(props) {
  // Split health indicators into two sets: LEDs and Labels
  const leds = {};
  const labels = {};
  for (let [key, value] of Object.entries(props.dict)) {
    if (typeof value == "object" && "Value" in value) {
      if (typeof value["Value"] == "boolean") {
        leds[key] = value;
      } else {
        labels[key] = value;
      }
    }
  }
  const listLEDs = [];
  for (let k in leds) {
    listLEDs.push(<IndicatorLight name={k} value={leds[k]} key={k} />);
  }
  const listLabels = [];
  for (let k in labels) {
    listLabels.push(<IndicatorLabel name={k} value={labels[k]} key={k} />);
  }
  return (
    <div className="healthContainer">
      <div>
        <div className="indicatorContainer">{listLEDs}</div>
      </div>
      <div>
        <div className="indicatorContainer">{listLabels}</div>
      </div>
    </div>
  );
}

export { Health };

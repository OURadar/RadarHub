//
//  health.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React from "react";
import { SectionHeader } from "./section-header";
import { prettyString } from "./common";

function styleFromEnum(x) {
  const enumStyle = ["normal", "ready", "alert", "old", "blue", "purple", ""];
  return enumStyle[Math.min(x, enumStyle.length - 1)];
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
    <div>
      <SectionHeader name="health" />
      <div className="healthContainer">
        {listLEDs.length > 0 && <div className="indicatorContainerLeft">{listLEDs}</div>}
        {listLabels.length > 0 && <div className="indicatorContainerRight">{listLabels}</div>}
      </div>
    </div>
  );
}

export { Health };

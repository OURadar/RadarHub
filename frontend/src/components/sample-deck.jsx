//
//  Scope.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React from "react";

function Sample(props) {
  var aux = "sample";
  if (props.value > 15000) {
    aux += " positive";
  } else if (props.value < -15000) {
    aux += " negative";
  }
  return <div className={aux}>{props.value}</div>;
}

function SampleDeck(props) {
  const samples = props.samples;
  if (samples.length > 0) {
    const listSamples = samples
      .toString()
      .split(",")
      .map((x, k) => <Sample value={x} key={k} />);
    return <div className="sampleContainer">{listSamples}</div>;
  }
  return <div></div>;
}

export { SampleDeck };

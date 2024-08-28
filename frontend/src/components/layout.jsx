//
//  Layout.js
//  RadarHub
//
//  Created by Boonleng Cheong on 8/18/2022.
//

import React from "react";
import Split from "split.js";

import { clamp } from "./common";

export function Layout(props) {
  React.useEffect(() => {
    const minLeftPanelWidth = props.minLeftPanelWidth || 400;
    const minRightPanelWidth = props.minRightPanelWidth || 500;
    const maxRightPanelWidth = props.maxRightPanelWidth || 300;
    const storageName = props.name || "split-archive-w";
    var w = localStorage.getItem(storageName);
    if (w) {
      w = clamp(parseFloat(JSON.parse(w)), minRightPanelWidth, window.innerWidth - minLeftPanelWidth);
    } else {
      w = maxRightPanelWidth;
    }
    let v = (w / window.innerWidth) * 100;
    Split(["#split-panel-left", "#split-panel-right"], {
      sizes: [100 - v, v],
      minSize: [minLeftPanelWidth, maxRightPanelWidth],
      expandToMin: true,
      elementStyle: (_dimension, elementSize, _gutterSize, index) => {
        if (index == 0) {
          return { width: `calc(100% - ${w}px)` };
        } else {
          w = (window.innerWidth * elementSize) / 100;
          return { width: `${w}px` };
        }
      },
      onDragEnd: (_sizes) => {
        w = parseFloat(w).toFixed(1);
        console.log(`Layout.onDragEnd: w = ${w} -> ${props.name}`);
        localStorage.setItem(storageName, JSON.stringify(w));
      },
    });
  }, []);
  return (
    <div id="split-panel">
      <div id="split-panel-left" className="container">
        {props.left}
      </div>
      <div id="split-panel-right" className="container">
        {props.right}
      </div>
    </div>
  );
}

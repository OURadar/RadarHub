//
//  control.js
//  RadarHub
//
//  Created by Boonleng Cheong on 7/26/2021
//

import React from "react";
import Button from "@material-ui/core/Button";
import { ThemeProvider } from "@material-ui/core/styles";
import { prettyString } from "./common";
import { theme } from "./theme";

function Control(props) {
  const controls = [];
  for (let k = 0; k < props.array.length; k++) {
    let b = props.array[k];
    if (typeof b == "object" && "Label" in b) {
      let label = prettyString(b.Label);
      controls.push(<Button key={k}>{label}</Button>);
    }
  }
  return (
    <ThemeProvider theme={theme}>
      <div className="controlContainer">{controls}</div>
    </ThemeProvider>
  );
}

export { Control };

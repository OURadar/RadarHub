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
  const elements = props.ingest.data.control;
  const controls = [];
  for (let k = 0; k < elements.length; k++) {
    let item = elements[k];
    if (typeof item == "object" && "Label" in item && "Command" in item) {
      controls.push(
        <Button
          onClick={() => {
            props.ingest.execute(item.Command);
          }}
          key={k}
        >
          {prettyString(item.Label)}
        </Button>
      );
    }
  }
  return (
    <ThemeProvider theme={theme}>
      <div className="controlContainer">{controls}</div>
    </ThemeProvider>
  );
}

export { Control };

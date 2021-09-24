//
//  control.js
//  RadarHub
//
//  Created by Boonleng Cheong on 7/26/2021
//

import React from "react";
import Button from "@mui/material/Button";
import { SectionHeader } from "./section-header";
import { prettyString } from "./common";

function Control(props) {
  const elements = props.ingest?.data.control || [];
  const controls = [];
  for (let k = 0; k < elements.length; k++) {
    let item = elements[k];
    if (typeof item == "object" && "Label" in item && "Command" in item) {
      controls.push(
        <Button
          key={k}
          onClick={() => {
            props.ingest.execute(item.Command);
          }}
          variant="control"
        >
          {prettyString(item.Label)}
        </Button>
      );
    }
  }
  return (
    <div>
      <SectionHeader name="control" />
      <div className="controlContainer">{controls}</div>
    </div>
  );
}

export { Control };

//
//  control.js
//  RadarHub
//
//  Created by Boonleng Cheong on 7/26/2021
//

import React from "react";
import { SectionHeader } from "./section-header";
import { prettyString } from "./common";
import { SingleButton, TandemButtons } from "./button";

function Control(props) {
  const elements = props.ingest?.data.control || [];
  const controls = [];
  for (let k = 0; k < elements.length; k++) {
    let item = elements[k];
    if (typeof item !== "object" || !("Label" in item)) {
      continue;
    }
    if ("Command" in item) {
      controls.push(
        <SingleButton
          key={k}
          onClick={() => {
            props.ingest.execute(item.Command);
          }}
        >
          {prettyString(item.Label)}
        </SingleButton>
      );
    } else if ("Left" in item && "Right" in item) {
      controls.push(
        <TandemButtons
          key={k}
          onClickLeft={() => {
            props.ingest.execute(item.Left);
          }}
          onClickRight={() => {
            props.ingest.execute(item.Right);
          }}
        >
          {prettyString(item.Label)}
        </TandemButtons>
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

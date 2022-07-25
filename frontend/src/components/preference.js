//
//  product.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React from "react";
// import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { DensityLarge, DensitySmall } from "@mui/icons-material";

export function Preference(props) {
  // const [update, setUpdate] = React.useState("null");

  // if (props.ingest) {
  //   console.log(`Preference ${update}`);
  //   // setUpdate(props.ingest.state.liveUpdate);
  // } else {
  //   // setUpdate("null");
  // }
  return (
    <div className="preferenceMenu">
      <ToggleButtonGroup
        color="primary"
        size="small"
        value={props.value}
        onChange={props.handleChange}
        orientation="vertical"
        exclusive
      >
        <ToggleButton value="scan">
          <DensityLarge />
        </ToggleButton>
        <ToggleButton value="always">
          <DensitySmall />
        </ToggleButton>
      </ToggleButtonGroup>
    </div>
  );
}

Preference.defaultProps = {
  ingest: null,
  handleChange: (_e, value) => {
    console.log(`Preference.handleChange()  value = ${value}`);
    // setUpdate(value);
  },
};

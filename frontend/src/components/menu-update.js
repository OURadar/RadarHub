//
//  preference.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React from "react";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { DensityLarge, DensitySmall } from "@mui/icons-material";

export function MenuUpdate(props) {
  return (
    <div id="update" className="floatMenu">
      <ToggleButtonGroup
        color="primary"
        variant="control"
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

MenuUpdate.defaultProps = {
  ingest: null,
  handleChange: (_e, value) => {
    console.log(`Preference.handleChange()  value = ${value}`);
  },
};

//
//  menu-update.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React from "react";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { DensityLarge, DensitySmall } from "@mui/icons-material";

export function MenuUpdate({
  value = "offline",
  onChange = (_e, value) => {
    console.log(`Preference.onChange()  value = ${value}`);
  },
}) {
  return (
    <div id="update" className="floatMenu roundCorder blur">
      <ToggleButtonGroup
        color="primary"
        size="small"
        value={value}
        onChange={onChange}
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

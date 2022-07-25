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
// import DensityLargeIcon from "@mui/icons-material/DensityLarge";
// import DensitySmallIcon from "@mui/icons-material/DensitySmall";
import { DensityLarge, DensitySmall } from "@mui/icons-material";

export function Preference() {
  const [update, setUpdate] = React.useState("scan");

  const handleChange = (_event, value) => {
    setUpdate(value);
  };

  return (
    <div className="preferenceMenu">
      <ToggleButtonGroup
        color="primary"
        size="small"
        value={update}
        exclusive
        onChange={handleChange}
        orientation="vertical"
      >
        <ToggleButton value="scan">
          <DensityLarge />
        </ToggleButton>
        <ToggleButton value="always" disabled>
          <DensitySmall />
        </ToggleButton>
      </ToggleButtonGroup>
    </div>
  );
}

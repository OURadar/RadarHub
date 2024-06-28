//
//  menu-arrow.js
//  RadarHub
//
//  This is a view
//
//  Created by Boonleng Cheong
//

import React from "react";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import {
  KeyboardArrowLeft,
  KeyboardArrowRight,
  PlayArrow,
  Pause,
  KeyboardDoubleArrowLeft,
  KeyboardDoubleArrowRight,
} from "@mui/icons-material";

export function MenuArrow({
  ingest = {
    grid: { pathsActive: new Array(4).fill(false) },
    navigateBackwardScan: () => console.log("MenuArrow.ingest.navigateBackwardScan"),
    navigateBackward: () => console.log("MenuArrow.ingest.navigateBackward"),
    playPause: () => console.log("MenuArrow.ingest.playPause"),
    navigateForward: () => console.log("MenuArrow.ingest.navigateLeft"),
    navigateForwardScan: () => console.log("MenuArrow.ingest.navigateForwardScan"),
  },
}) {
  const ok = ingest?.grid !== null || false;
  const disabled = ok ? ingest.grid.pathsActive.map((x) => !x) : new Array(4).fill(true);
  const playing = ingest?.data?.sweeps.length > 1 || false;
  return (
    <div id="arrow" className="floatMenu roundCorder blur">
      <ToggleButtonGroup color="secondary" size="small" value={-1} orientation="vertical">
        <ToggleButton value={0} onClick={() => ingest.navigateBackwardScan()} disabled={disabled[0]}>
          <KeyboardDoubleArrowLeft />
        </ToggleButton>
        <ToggleButton value={1} onClick={() => ingest.navigateBackward()} disabled={disabled[1]}>
          <KeyboardArrowLeft />
        </ToggleButton>
        <ToggleButton value={2} onClick={() => ingest.playPause()}>
          {(playing && <Pause />) || <PlayArrow />}
        </ToggleButton>
        <ToggleButton value={3} onClick={() => ingest.navigateForward()} disabled={disabled[2]}>
          <KeyboardArrowRight />
        </ToggleButton>
        <ToggleButton value={4} onClick={() => ingest.navigateForwardScan()} disabled={disabled[3]}>
          <KeyboardDoubleArrowRight />
        </ToggleButton>
      </ToggleButtonGroup>
    </div>
  );
}

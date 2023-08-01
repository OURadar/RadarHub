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

export function MenuArrow(props) {
  const ok = props.ingest?.grid !== null || false;
  const disabled = ok ? props.ingest.grid.pathsActive.map((x) => !x) : new Array(4).fill(true);
  const playing = props.ingest?.data?.sweeps.length > 1 || false;
  return (
    <div id="arrow" className="floatMenu roundCorder blur">
      <ToggleButtonGroup color="secondary" size="small" value={-1} orientation="vertical">
        <ToggleButton value={0} onClick={() => props.ingest.navigateBackwardScan()} disabled={disabled[0]}>
          <KeyboardDoubleArrowLeft />
        </ToggleButton>
        <ToggleButton value={1} onClick={() => props.ingest.navigateBackward()} disabled={disabled[1]}>
          <KeyboardArrowLeft />
        </ToggleButton>
        <ToggleButton value={2} onClick={() => props.ingest.playPause()}>
          {(playing && <Pause />) || <PlayArrow />}
        </ToggleButton>
        <ToggleButton value={3} onClick={() => props.ingest.navigateForward()} disabled={disabled[2]}>
          <KeyboardArrowRight />
        </ToggleButton>
        <ToggleButton value={4} onClick={() => props.ingest.navigateForwardScan()} disabled={disabled[3]}>
          <KeyboardDoubleArrowRight />
        </ToggleButton>
      </ToggleButtonGroup>
    </div>
  );
}

MenuArrow.defaultProps = {
  ingest: {
    grid: { pathsActive: new Array(4).fill(false) },
    navigateBackwardScan: () => console.log("MenuArrow.ingest.navigateBackwardScan"),
    navigateBackward: () => console.log("MenuArrow.ingest.navigateBackward"),
    playPause: () => console.log("MenuArrow.ingest.playPause"),
    navigateForward: () => console.log("MenuArrow.ingest.navigateLeft"),
    navigateForwardScan: () => console.log("MenuArrow.ingest.navigateForwardScan"),
  },
};

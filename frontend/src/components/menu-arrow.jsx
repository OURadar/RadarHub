//
//  menu-arrow.js
//  RadarHub
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
        <ToggleButton value={0} onClick={props.onDoubleLeft} disabled={disabled[0]}>
          <KeyboardDoubleArrowLeft />
        </ToggleButton>
        <ToggleButton value={1} onClick={props.onLeft} disabled={disabled[1]}>
          <KeyboardArrowLeft />
        </ToggleButton>
        <ToggleButton value={2} onClick={props.onPlay}>
          {(playing && <Pause />) || <PlayArrow />}
        </ToggleButton>
        <ToggleButton value={3} onClick={props.onRight} disabled={disabled[2]}>
          <KeyboardArrowRight />
        </ToggleButton>
        <ToggleButton value={4} onClick={props.onDoubleRight} disabled={disabled[3]}>
          <KeyboardDoubleArrowRight />
        </ToggleButton>
      </ToggleButtonGroup>
    </div>
  );
}

MenuArrow.defaultProps = {
  ingest: null,
  onDoubleLeft: () => console.log("MenuArrow.onDoubleLeft"),
  onLeft: () => console.log("MenuArrow.onLeft"),
  onPlay: () => console.log("MenuArrow.onPlay"),
  onRight: () => console.log("MenuArrow.onRight"),
  onDoubleRight: () => console.log("MenuArrow.onDoubleRight"),
};

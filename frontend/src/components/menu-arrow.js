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
  KeyboardDoubleArrowLeft,
  KeyboardDoubleArrowRight,
} from "@mui/icons-material";

export function MenuArrow(props) {
  return (
    <div id="arrow" className="floatMenu roundCorder blur">
      <ToggleButtonGroup
        color="secondary"
        size="small"
        value={-1}
        orientation="vertical"
      >
        <ToggleButton
          value={0}
          onClick={props.onDoubleLeft}
          disabled={props.doubleLeftDisabled}
        >
          <KeyboardDoubleArrowLeft />
        </ToggleButton>
        <ToggleButton
          value={1}
          onClick={props.onLeft}
          disabled={props.leftDisabled}
        >
          <KeyboardArrowLeft />
        </ToggleButton>
        <ToggleButton
          value={2}
          onClick={props.onRight}
          disabled={props.rightDisabled}
        >
          <KeyboardArrowRight />
        </ToggleButton>
        <ToggleButton
          value={3}
          onClick={props.onDoubleRight}
          disabled={props.doubleRightDisabled}
        >
          <KeyboardDoubleArrowRight />
        </ToggleButton>
      </ToggleButtonGroup>
    </div>
  );
}

MenuArrow.defaultProps = {
  doubleLeftDisabled: false,
  leftDisabled: false,
  rightDisabled: false,
  doubleRightDisabled: false,
  onDoubleLeft: () => console.log("MenuArrow.onDoubleLeft"),
  onLeft: () => console.log("MenuArrow.onLeft"),
  onRight: () => console.log("MenuArrow.onRight"),
  onDoubleRight: () => console.log("MenuArrow.onDoubleRight"),
};

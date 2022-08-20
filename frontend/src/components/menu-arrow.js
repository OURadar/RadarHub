import React from "react";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import {
  KeyboardArrowLeft,
  KeyboardArrowRight,
  KeyboardDoubleArrowLeft,
  KeyboardDoubleArrowRight,
} from "@mui/icons-material";

export function MenuArrow(props) {
  return (
    <div id="arrow" className="floatMenu roundCorder blur">
      <ButtonGroup
        size="large"
        color="secondary"
        variant="outlined"
        orientation="vertical"
        arial-label="navigation-button-group"
      >
        <Button
          onClick={props.onDoubleLeft}
          disabled={props.doubleLeftDisabled}
        >
          <KeyboardDoubleArrowLeft />
        </Button>
        <Button onClick={props.onLeft} disabled={props.leftDisabled}>
          <KeyboardArrowLeft />
        </Button>
        <Button onClick={props.onRight} disabled={props.rightDisabled}>
          <KeyboardArrowRight />
        </Button>
        <Button
          onClick={props.onDoubleRight}
          disabled={props.doubleRightDisabled}
        >
          <KeyboardDoubleArrowRight />
        </Button>
      </ButtonGroup>
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

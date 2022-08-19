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
    <div id="arrow" className="floatMenu blur">
      <ButtonGroup
        size="large"
        color="secondary"
        variant="outlined"
        orientation="vertical"
        arial-label="navigation-button-group"
      >
        <Button onClick={props.onDoubleLeft}>
          <KeyboardDoubleArrowLeft />
        </Button>
        <Button onClick={props.onLeft}>
          <KeyboardArrowLeft />
        </Button>
        <Button onClick={props.onRight}>
          <KeyboardArrowRight />
        </Button>
        <Button onClick={props.onDoubleRight}>
          <KeyboardDoubleArrowRight />
        </Button>
      </ButtonGroup>
    </div>
  );
}

MenuArrow.defaultProps = {
  onDoubleLeft: () => {
    console.log("double-left");
  },
  onLeft: () => {
    console.log("left");
  },
  onRight: () => {
    console.log("right");
  },
  onDoubleRight: () => {
    console.log("double-right");
  },
};

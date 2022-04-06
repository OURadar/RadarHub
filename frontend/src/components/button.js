import React from "react";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";

function SingleButton({ children, disabled, onClick, ...props }) {
  return (
    <div className="buttonContainer">
      <Button variant="control" onClick={!disabled ? onClick : () => {}}>
        {children || "button"}
      </Button>
    </div>
  );
}

function TandemButtons({
  children,
  disabled,
  onClickLeft,
  onClickRight,
  ...props
}) {
  return (
    <div className="buttonContainer">
      <ButtonGroup variant="control">
        <Button variant="side" onClick={!disabled ? onClickLeft : () => {}}>
          {"<"}
        </Button>
        <div className="buttonValue">{children || "value"}</div>
        <Button variant="side" onClick={!disabled ? onClickRight : () => {}}>
          {">"}
        </Button>
      </ButtonGroup>
    </div>
  );
}

export { SingleButton, TandemButtons };

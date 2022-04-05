import React from "react";

const Button = ({ children, disabled, onClick, ...props }) => {
  return (
    <div className="buttonContainer">
      <div className="plainButton" onClick={!disabled ? onClick : () => {}}>
        {children || "button"}
      </div>
    </div>
  );
};

const TandemButtons = ({
  children,
  disabled,
  onClickLeft,
  onClickRight,
  ...props
}) => {
  return (
    <div className="buttonContainer">
      <div
        className="tandemButtonLeft"
        onClick={!disabled ? onClickLeft : () => {}}
      >
        {"-"}
      </div>
      <div className="tandemButtonText">{children}</div>
      <div
        className="tandemButtonRight"
        onClick={!disabled ? onClickRight : () => {}}
      >
        {"+"}
      </div>
    </div>
  );
};

export { Button, TandemButtons };

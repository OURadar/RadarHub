import React from "react";
function Caption(props) {
  return (
    <div id={props.id} className="floatText">
      {props.string}
    </div>
  );
}

Caption.defaultProps = {
  id: "caption",
  string: "caption-string",
};

export { Caption };

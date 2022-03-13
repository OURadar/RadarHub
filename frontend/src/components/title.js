import React from "react";

function Title(props) {
  return (
    <div id={props.id} className="floatText">
      {props.string}
    </div>
  );
}

Title.defaultProps = {
  id: "title",
  string: "title-string",
};

export { Title };

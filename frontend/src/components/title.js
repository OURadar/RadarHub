//
//  title.js - Title
//  RadarHub
//
//  This is a view
//
//  Created by Boonleng Cheong
//

import React from "react";

function Title(props) {
  const svgRef = React.useRef(null);

  const [x, setX] = React.useState(props.x || 0);
  const [p, setP] = React.useState(props.p || 6);
  const [h, setH] = React.useState(props.h || 32);

  React.useEffect(() => {
    if (svgRef === null) return;
    const style = getComputedStyle(svgRef.current);
    const align = style.getPropertyValue("text-align");
    const width = parseInt(style.getPropertyValue("width"));
    const stroke = Math.max(
      3,
      parseInt(style.getPropertyValue("stroke-width"))
    );
    setP(stroke);
    if (align == "center") {
      setX(0.5 * width);
    } else if (align == "right") {
      setX(width - p);
    } else {
      setX(p);
    }
    const height = parseFloat(style.getPropertyValue("font-size"));
    setH(height);
    // console.log(
    //   `Title() align = ${align}   width = ${width}   x = ${x}   height = ${height}   p = ${p}`
    // );
  });

  return (
    <svg id={props.id} ref={svgRef} height={h + 2 * p}>
      <text x={x} y={h + p}>
        {props.string}
      </text>
    </svg>
  );
}

Title.defaultProps = {
  id: "title",
  string: "title-string",
};

export { Title };

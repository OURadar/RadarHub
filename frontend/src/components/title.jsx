//
//  title.js - Title
//  RadarHub
//
//  This is a view
//
//  Created by Boonleng Cheong
//

import React from "react";

const Title = React.memo(function Title({ id = "title", string = "title-string" }) {
  const svgRef = React.useRef(null);

  const [x, setX] = React.useState(0);
  const [p, setP] = React.useState(6);
  const [h, setH] = React.useState(32);

  React.useEffect(() => {
    if (svgRef === null) return;
    const style = getComputedStyle(svgRef.current);
    const align = style.getPropertyValue("text-align");
    const width = parseInt(style.getPropertyValue("width"));
    const stroke = Math.max(3, parseInt(style.getPropertyValue("stroke-width")));
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
    <svg id={id} ref={svgRef} height={h + 2 * p}>
      <text x={x} y={h + p}>
        {string}
      </text>
    </svg>
  );
});

export { Title };

import React from "react";

export function Symbol({
  id = "id",
  text = "text",
  symbol = "SYM",
  anchor = "end",
  count = 0,
  pad = 6,
  // onTouch: () => console.log("Symbol.onTouch"),
  onClick = () => console.log("Symbol.onClick"),
}) {
  const w = 280;
  const x = anchor == "start" ? 5 : anchor == "middle" ? 0.5 * w : w - 5;
  const svgRef = React.useRef(null);
  const [p, setP] = React.useState(pad);

  React.useEffect(() => {
    if (svgRef === null) return;
    const style = getComputedStyle(svgRef.current);
    const stroke = Math.max(3, parseInt(style.getPropertyValue("stroke-width")));
    setP(stroke);
  }, []);

  React.useEffect(() => {
    const fn = (e) => onClick(e);
    // svgRef.current.addEventListener("touchend", onTouch);
    svgRef.current.addEventListener("mouseup", fn);

    return () => {
      // svgRef.current.removeEventListener("touchend", onTouch);
      svgRef.current.removeEventListener("mouseup", fn);
    };
  }, [count]);

  return (
    <svg id={id} ref={svgRef} width={w} height="80" className="floatText">
      <text id="symbol" x={x} y={66 + p} textAnchor={anchor}>
        {symbol}
      </text>
      <text id="text" x={x} y={16 + p} textAnchor={anchor}>
        {text}
      </text>
    </svg>
  );
}

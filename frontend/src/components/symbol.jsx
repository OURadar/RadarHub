import React from "react";

export function Symbol(props) {
  const svgRef = React.useRef(null);

  const [p, setP] = React.useState(props.pad);

  React.useEffect(() => {
    if (svgRef === null) return;
    const style = getComputedStyle(svgRef.current);
    const stroke = Math.max(3, parseInt(style.getPropertyValue("stroke-width")));
    setP(stroke);
  }, []);

  React.useEffect(() => {
    // const onTouch = (e) => props.onTouch(e);
    const onClick = (e) => props.onClick(e);
    // svgRef.current.addEventListener("touchend", onTouch);
    svgRef.current.addEventListener("mouseup", onClick);

    return () => {
      // svgRef.current.removeEventListener("touchend", onTouch);
      svgRef.current.removeEventListener("mouseup", onClick);
    };
  }, [props.count]);

  const w = 280;
  const x = props.anchor == "start" ? 5 : props.anchor == "middle" ? 0.5 * w : w - 5;

  return (
    <svg id={props.id} ref={svgRef} width={w} height="80" className="floatText">
      <text id="symbol" x={x} y={66 + p} textAnchor={props.anchor}>
        {props.symbol}
      </text>
      <text id="text" x={x} y={16 + p} textAnchor={props.anchor}>
        {props.text}
      </text>
    </svg>
  );
}

Symbol.defaultProps = {
  id: "id",
  text: "text",
  symbol: "SYM",
  anchor: "end",
  count: 0,
  pad: 6,
  // onTouch: () => console.log("Symbol.onTouch"),
  onClick: () => console.log("Symbol.onClick"),
};

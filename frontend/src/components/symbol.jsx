import React from "react";

export function Symbol(props) {
  const svgRef = React.useRef(null);

  const [p, setP] = React.useState(props.p || 6);

  React.useEffect(() => {
    if (svgRef === null) return;
    const style = getComputedStyle(svgRef.current);
    const stroke = Math.max(
      3,
      parseInt(style.getPropertyValue("stroke-width"))
    );
    setP(stroke);
  });

  React.useEffect(() => {
    const onTouch = (e) => props.onTouch(e);
    const onClick = (e) => props.onClick(e);
    svgRef.current.addEventListener("touchend", onTouch);
    svgRef.current.addEventListener("mouseup", onClick);

    return () => {
      svgRef.current.removeEventListener("touchend", onTouch);
      svgRef.current.removeEventListener("mouseup", onClick);
    };
  }, [props.count]);

  return (
    <svg
      id={props.id}
      ref={svgRef}
      width="280"
      height="80"
      className="floatText"
    >
      <text id="symbol" x={5} y={66 + p}>
        {props.symbol}
      </text>
      <text id="text" x={5} y={16 + p}>
        {props.text}
      </text>
    </svg>
  );
}

Symbol.defaultProps = {
  id: "symbol",
  text: "Unknown",
  symbol: "U",
  count: 0,
  onTouch: () => console.log("Symbol.onTouch"),
  onClick: () => console.log("Symbol.onClick"),
};

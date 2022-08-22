import React from "react";
// function Caption(props) {
//   return (
//     <div id={props.id} className="floatText">
//       {props.string}
//     </div>
//   );
// }

function measure(string) {}
function Caption(props) {
  const h = props.h || 20;
  const l = props.l || 5;
  const lines = props.string.split(/\r?\n/);

  const svgRef = React.useRef(null);

  // React.useEffect(() => {
  //   const style = getComputedStyle(svgRef.current);
  //   const lineHeight = style.getPropertyValue("line-height");
  //   // console.log(style);
  //   console.log(`lineHeight = ${lineHeight}`);
  // });

  return (
    <svg
      id={props.id}
      ref={svgRef}
      width="150"
      height={lines.length * h + 10}
      className="floatText"
    >
      {lines.map((line, i) => (
        <text key={"c" + i} x={l} y={i * h + h}>
          {line}
        </text>
      ))}
    </svg>
  );
}

Caption.defaultProps = {
  id: "caption",
  string: "caption-string",
};

export { Caption };

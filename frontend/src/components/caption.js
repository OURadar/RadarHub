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
  const svgRef = React.useRef(null);
  const h = props.h || 20;

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
      height="100"
      className="floatText"
    >
      {props.string.split(/\r?\n/).map((x, i) => (
        <text key={"c" + i} x="0" y={i * h + h}>
          {x}
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

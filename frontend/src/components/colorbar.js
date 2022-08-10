//
//  colorbar.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { useRef } from "react";

function draw(context, theme) {
  const scale = window.devicePixelRatio > 1 ? 2 : 1;

  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.lineWidth = 1.0;
  context.beginPath();
  context.moveTo(10, 10);
  context.lineTo(50, 10);
  context.closePath();
  context.stroke();

  const text = "bitcoin";
  context.font = `${20 * scale}px LabelFont`;
  context.lineWidth = theme.width * scale;
  context.fillStyle = theme.face;
  context.strokeStyle = theme.stroke;
  context.strokeText(text, 40, 55);
  context.fillText(text, 40, 55);
}
export function Colorbar(props) {
  const canvasRef = useRef(null);

  React.useEffect(() => {
    const scale = window.devicePixelRatio > 1 ? 2 : 1;
    const canvas = canvasRef.current;
    const computedStyle = getComputedStyle(document.body);
    const topbarHeight = parseFloat(
      computedStyle.getPropertyValue("--topbar-height")
    );
    if (props.style == "top") {
      canvas.width = window.innerWidth * scale;
      canvas.height = topbarHeight * scale;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = "56px";
      canvas.style.top = `${topbarHeight}px`;
      if (props.debug)
        console.debug(
          `window size = ${window.innerWidth} x ${window.innerHeight}` +
            `  topbarHeight = ${topbarHeight}`
        );
    } else {
      canvas.width = 200 * scale;
      canvas.height = 600 * scale;
      canvas.style.width = "200px";
      canvas.style.height = "600px";
      canvas.style.right = 0;
      canvas.style.bottom = 0;
    }
    // canvas.width = scale * (props.width || 300);
    // canvas.height = scale * (props.height || 200);
    const context = canvas.getContext("2d");

    if (props.debug)
      console.debug(
        `drawing ... ${canvas.style.width} x ${canvas.style.height}` +
          ` @ ${window.devicePixelRatio} -> ${canvas.width} x ${canvas.height}`
      );

    console.log(props);
    const theme = {
      blank: false,
      face: props.colors.label.face,
      stroke: props.colors.label.stroke,
      width: 3.5,
    };

    draw(context, theme);
  }, []);

  return <canvas className="colorbar" ref={canvasRef} />;
}

// Colorbar.defaultProps = {
//   style: "top",
// };

//
//  colorbar.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { useRef } from "react";

function draw(context) {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.lineWidth = 2.0;
  context.beginPath();
  context.moveTo(10, 10);
  context.lineTo(50, 20);
  context.closePath();
  context.stroke();
}
export function Colorbar(props) {
  const canvasRef = useRef(null);

  const scale = window.devicePixelRatio > 1 ? 2 : 1;

  // const width = 390 * scale;
  // const height = 150 * scale;
  // canvas.width = width;
  // canvas.height = height;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    // canvas.width = scale * (props.width || 300);
    // canvas.height = scale * (props.height || 200);
    const context = canvas.getContext("2d");

    console.log(`drawing ... ${canvas.width} x ${canvas.height}`);

    draw(context);
  }, []);

  return (
    <div className="colorbar">
      "Colorbar"
      <canvas ref={canvasRef} />
    </div>
  );
}

// Colorbar.defaultProps = {
//   style: "top",
// };

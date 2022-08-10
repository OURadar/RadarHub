//
//  colorbar.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { useRef } from "react";

function draw(context, params) {
  const scale = window.devicePixelRatio > 1 ? 2 : 1;
  const lineWidth = 3.5;

  if (params.gravity == "right") {
    // Colorbar dimension: 20 x 255
    const yscale = Math.round(2.0 * scale);
    const height = Math.round(255 * yscale);
    const width = Math.round(20 * scale);
    const originX = Math.round(context.canvas.width - 80 * scale);
    const originY = Math.round(context.canvas.height - 20 * scale);
    const tickOffset = yscale - 1;
    context.translate(originX, originY);
    context.font = `${16 * scale}px LabelFont`;
    params.style.ticks.forEach((tick) => {
      let y = 0.5 * scale - tick.pos * yscale + tickOffset;
      context.strokeStyle = params.face;
      // console.log(`tick.pos = ${tick.pos}   y = ${y}`);
      if (params.blank) {
        context.lineWidth = lineWidth;
        context.beginPath();
        context.moveTo(22.5 * scale, y);
        context.lineTo(28.5 * scale, y);
        context.closePath();
        context.stroke();
      } else {
        context.lineWidth = scale;
        context.beginPath();
        context.moveTo(22.5 * scale, y);
        context.lineTo(27.5 * scale, y);
        context.closePath();
        context.stroke();
      }
      context.lineWidth = lineWidth;
      let meas = context.measureText(tick.text);
      let xx = 34 * scale;
      let yy = y + 0.5 * meas.actualBoundingBoxAscent;
      context.fillStyle = params.face;
      context.strokeStyle = params.stroke;
      context.strokeText(tick.text, xx, yy);
      context.fillText(tick.text, xx, yy);
    });
    // Colorbar shades. The first shade is transparent.
    context.lineWidth = lineWidth;
    context.rotate(-0.5 * Math.PI);
    context.imageSmoothingEnabled = false;
    if (params.blank) {
      context.fillStyle = params.face;
      context.strokeRect(-1.5, -1.5, height + 3, width + 3);
      context.fillRect(0, 0, height, width);
    } else {
      context.clearRect(0, 0, height, width);
      context.drawImage(
        params.palette,
        1,
        params.style.index,
        255,
        1,
        0,
        0,
        height,
        width
      );
    }
    context.lineWidth = scale;
    context.strokeStyle = params.face;
    context.strokeRect(
      -1.5 * context.lineWidth,
      -1.5 * context.lineWidth,
      height + 3 * scale,
      width + 3 * scale
    );

    context.font = `${20 * scale}px LabelFont`;
    context.lineWidth = lineWidth;
    context.fillStyle = params.face;
    context.strokeStyle = params.stroke;
    let meas = context.measureText(params.style.name);
    let x = 0.5 * (height - meas.width);
    context.strokeText(params.style.name, x, -18 * scale);
    context.fillText(params.style.name, x, -18 * scale);

    context.setTransform(1, 0, 0, 1, 0, 0);

    context.lineWidth = scale;
    context.strokeStyle = params.stroke;
    context.strokeRect(
      originX - 0.5 * context.lineWidth,
      originY - 0.5 * context.lineWidth - height,
      width + scale,
      height + scale
    );
  } else {
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.lineWidth = 1.0;
    context.beginPath();
    context.moveTo(10, 10);
    context.lineTo(50, 10);
    context.closePath();
    context.stroke();

    const text = "bitcoin";
    context.font = `${20 * scale}px LabelFont`;
    context.lineWidth = params.width * scale;
    context.fillStyle = params.face;
    context.strokeStyle = params.stroke;
    context.strokeText(text, 40, 55);
    context.fillText(text, 40, 55);

    context.imageSmoothingEnabled = false;
    context.drawImage(
      params.palette,
      1,
      params.index,
      255,
      1,
      120,
      36,
      600,
      32
    );
  }
}

export function Colorbar(props) {
  const index = props.index;
  const colors = props.colors;
  const palette = props.palette;
  const canvasRef = useRef(null);
  const scale = window.devicePixelRatio > 1 ? 2 : 1;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const computedStyle = getComputedStyle(document.body);
    const topbarHeight = parseFloat(
      computedStyle.getPropertyValue("--topbar-height")
    );
    if (props.gravity == "top") {
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
      canvas.width = 130 * scale;
      canvas.height = 550 * scale;
      canvas.style.width = "130px";
      canvas.style.height = "550px";
      canvas.style.right = "30px";
      canvas.style.bottom = "100px";
    }
  }, []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (palette === null) return;

    if (props.debug)
      console.debug(
        `drawing ... ${canvas.style.width} x ${canvas.style.height}` +
          ` @ ${window.devicePixelRatio} -> ${canvas.width} x ${canvas.height}`
      );

    console.log(props);

    context.shadowColor = props.debug ? "#ff9922dd" : props.colors.label.stroke;
    context.shadowBlur = 10 * scale;
    draw(context, {
      blank: true,
      gravity: props.gravity,
      palette: props.palette,
      index: props.style.index,
      face: props.debug ? "#ff9922dd" : props.colors.label.stroke,
      stroke: props.debug ? "#ff9922dd" : props.colors.label.stroke,
      style: props.style,
    });

    context.shadowColor = "rgba(128, 128, 128, 0)";
    context.shadowBlur = 0;
    draw(context, {
      blank: false,
      gravity: props.gravity,
      palette: props.palette,
      index: props.style.index,
      face: props.colors.label.face,
      stroke: props.colors.label.stroke,
      style: props.style,
    });
  }, [index, colors, palette]);

  return <canvas className="colorbar" ref={canvasRef} />;
}

// Colorbar.defaultProps = {
//   style: "top",
// };

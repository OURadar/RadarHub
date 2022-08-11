//
//  colorbar.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { useRef } from "react";

function draw(context, params) {
  const scale = window.devicePixelRatio;
  const lineWidth = 3.5 * scale;

  context.lineWidth = 1.0;
  context.strokeStyle = params.face;

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
      context.lineWidth = params.blank ? lineWidth + scale : scale;
      // console.log(`tick.pos = ${tick.pos}   y = ${y}`);
      context.beginPath();
      context.moveTo(22 * scale - 0.5 * context.lineWidth, y);
      context.lineTo(27 * scale + 0.5 * context.lineWidth, y);
      context.closePath();
      context.stroke();

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
      context.fillRect(-scale, -scale, height + 2 * scale, width + 2 * scale);
    } else {
      context.clearRect(0, 0, height, width);
      context.drawImage(
        params.palette,
        1,
        params.style.index,
        params.palette.width - 1,
        1,
        0,
        0,
        height,
        width
      );
    }

    context.font = `${20 * scale}px LabelFont`;
    context.lineWidth = lineWidth;
    context.fillStyle = params.face;
    context.strokeStyle = params.stroke;
    let meas = context.measureText(params.style.name);
    let x = 0.5 * (height - meas.width);
    context.strokeText(params.style.name, x, -18 * scale);
    context.fillText(params.style.name, x, -18 * scale);

    context.setTransform(1, 0, 0, 1, 0, 0);

    context.strokeStyle = params.face;
    if (params.blank) {
      context.lineWidth = lineWidth;
      context.strokeRect(
        originX - 2 * scale,
        originY - 2 * scale - height,
        width + 4 * scale,
        height + 4 * scale
      );
    } else {
      context.lineWidth = scale;
      context.strokeRect(
        originX - 1.5 * scale,
        originY - 1.5 * scale - height,
        width + 3 * scale,
        height + 3 * scale
      );
    }
  } else {
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);

    context.lineWidth = 3;
    context.strokeStyle = "red";
    // context.strokeRect(9.5, 9.5, 12, 12);
    context.strokeRect(10.5, 10.5, 10, 10);

    context.lineWidth = 1;
    context.strokeStyle = "black";
    context.strokeRect(10.5, 10.5, 10, 10);

    // context.lineWidth = scale;
    // context.beginPath();
    // context.moveTo(10, 10);
    // context.lineTo(50, 10);
    // context.closePath();
    // context.stroke();

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
      params.palette.width - 1,
      1,
      120,
      36,
      600,
      32
    );
    context.strokeStyle = "rgba(255, 160, 0, 0.8)";
    context.lineWidth = 2.0 * scale;
    context.strokeRect(
      0.5 * context.lineWidth,
      0.5 * context.lineWidth,
      context.canvas.width - context.lineWidth,
      context.canvas.height - context.lineWidth
    );
  }
}

function setCanvasSize(canvas, width, height) {
  const scale = window.devicePixelRatio;
  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

export function Colorbar(props) {
  const index = props.index;
  const colors = props.colors;
  const palette = props.palette;
  const canvasRef = useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const computedStyle = getComputedStyle(document.body);
    const topbarHeight = computedStyle.getPropertyValue("--topbar-height");
    if (props.gravity == "top") {
      setCanvasSize(canvas, window.innerWidth, 64);
      canvas.style.top = topbarHeight;
    } else {
      setCanvasSize(canvas, 130, 550);
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
    context.shadowBlur = 10 * window.devicePixelRatio;
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

Colorbar.defaultProps = {
  gravity: "top",
};

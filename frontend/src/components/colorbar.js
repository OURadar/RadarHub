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

  context.clearRect(0, 0, context.canvas.width, context.canvas.height);

  if (params.gravity == "right") {
    // Colorbar dimension: 20 x 510 (not 512, we paint one shade less, more later)
    const width = Math.round(20 * scale);
    const height = Math.round(510 * scale);
    const yscale = Math.round(2.0 * scale);
    const originX = Math.round(context.canvas.width - 80 * scale);
    const originY = Math.round(context.canvas.height - 20 * scale);
    const tickOffset = yscale - 1;

    // Move the origin reference for drawing ticks
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

    // Colorbar shades. The first shade is transparent so we only paint shades 1 - 255
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
    context.rotate(0.5 * Math.PI);

    // Title of the colorbar
    context.font = `${20 * scale}px LabelFont`;
    context.lineWidth = lineWidth;
    context.fillStyle = params.face;
    context.strokeStyle = params.stroke;
    let meas = context.measureText(params.style.name);
    let x = 0.5 * (height - meas.width);
    context.strokeText(params.style.name, x, -18 * scale);
    context.fillText(params.style.name, x, -18 * scale);

    // Outline of the colorbar
    context.strokeStyle = params.face;
    if (params.blank) {
      context.lineWidth = lineWidth;
      context.strokeRect(
        -2 * scale,
        -2 * scale - height,
        width + 4 * scale,
        height + 4 * scale
      );
    } else {
      context.lineWidth = scale;
      context.strokeRect(
        -1.5 * scale,
        -1.5 * scale - height,
        width + 3 * scale,
        height + 3 * scale
      );
    }
  } else {
    // console.log(`scale = ${scale}`);

    // context.lineWidth = 3 * scale;
    // context.strokeStyle = "red";
    // context.strokeRect(10.5, 10.5, 30, 30);

    // context.lineWidth = 1;
    // context.strokeStyle = "black";
    // context.strokeRect(10.5, 10.5, 10, 10);

    // Colorbar dimension: (0.8 * w) x (0.08 * w)
    const width = Math.round(0.8 * context.canvas.width);
    const height = Math.round(0.2 * context.canvas.height);
    const xscale = Math.round(width / 255.0);
    const originX = Math.round(0.1 * context.canvas.width);
    const originY = Math.round(0.4 * context.canvas.height);
    const tickOffset = xscale - 1;
    console.log(`width = ${width}   height = ${height}   xscale = ${xscale}`);

    // Move the origin reference for drawing ticks
    context.translate(originX, originY);

    // Colorbar shades. The first shade is transparent so we only paint shades 1 - 255
    context.imageSmoothingEnabled = false;
    if (params.blank) {
      context.fillStyle = params.face;
      context.fillRect(-scale, -scale, height + 2 * scale, width + 2 * scale);
    } else {
      context.imageSmoothingEnabled = false;
      context.drawImage(
        params.palette,
        1,
        params.index,
        params.palette.width - 1,
        1,
        0,
        0,
        width,
        height
      );
    }

    // Outline of the colorbar
    context.strokeStyle = params.face;
    if (params.blank) {
      context.lineWidth = lineWidth;
      context.strokeRect(
        -2 * scale,
        -2 * scale,
        width + 4 * scale,
        height + 4 * scale
      );
    } else {
      context.lineWidth = scale;
      context.strokeRect(
        -1.5 * scale,
        -1.5 * scale,
        width + 3 * scale,
        height + 3 * scale
      );
    }
  }

  // Reset the transformation
  context.setTransform(1, 0, 0, 1, 0, 0);

  if (params.debug) {
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
      debug: props.debug,
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
      debug: props.debug,
    });
  }, [index, colors, palette]);

  return <canvas className="colorbar" ref={canvasRef} />;
}

Colorbar.defaultProps = {
  gravity: "top",
};

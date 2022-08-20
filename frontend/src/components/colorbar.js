//
//  colorbar.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React from "react";

import { detectMob } from "./common";

function draw(context, params) {
  const scale = window.devicePixelRatio;
  const lineWidth = 3.5 * scale;

  if (params.gravity == "right") {
    // Colorbar dimension: 20 x 510 (not 512, we paint one shade less, more later)
    const width = Math.round(20 * scale);
    const height = Math.round(510 * scale);
    const yscale = Math.round(2.0 * scale);
    const originX = Math.round(context.canvas.width - 80 * scale);
    const originY = Math.round(context.canvas.height - 20 * scale);
    const tickOffset = yscale - 1;

    // Move the origin reference
    context.translate(originX, originY);
    context.font = `${16 * scale}px LabelFont`;

    // Ticks
    params.style.ticks.forEach((tick) => {
      let t = 0.5 * scale - tick.pos * yscale + tickOffset;
      context.strokeStyle = params.face;
      context.lineWidth = params.blank ? lineWidth + scale : scale;
      // console.log(`tick.pos = ${tick.pos}   y = ${y}`);
      context.beginPath();
      context.moveTo(22 * scale - 0.5 * context.lineWidth, t);
      context.lineTo(27 * scale + 0.5 * context.lineWidth, t);
      context.closePath();
      context.stroke();

      context.lineWidth = lineWidth;
      let meas = context.measureText(tick.text);
      let xx = 34 * scale;
      let yy = t + 0.5 * meas.actualBoundingBoxAscent;
      context.fillStyle = params.face;
      context.strokeStyle = params.stroke;
      context.strokeText(tick.text, xx, yy);
      context.fillText(tick.text, xx, yy);
    });

    // Colorbar shades. The first shade is transparent so only paint shades 1 - 255
    context.rotate(-0.5 * Math.PI);
    if (params.blank) {
      context.fillStyle = params.face;
      context.fillRect(-scale, -scale, height + 2 * scale, width + 2 * scale);
    } else {
      context.clearRect(0, 0, height, width);
      context.imageSmoothingEnabled = false;
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
    // Colorbar dimension: (0.85 * w) x (0.2 * h)
    const width = Math.round(0.85 * context.canvas.width);
    const height = Math.round(0.2 * context.canvas.height);
    const xscale = width / 255.0;
    const originX = Math.round(0.5 * (context.canvas.width - width));
    const originY = Math.round(0.42 * context.canvas.height);
    const tickOffset = Math.round(xscale - 1);
    // console.log(`${width} x ${height}   xscale = ${xscale} / ${tickOffset}`);

    // Move the origin reference
    context.translate(originX, originY);

    // Colorbar shades. The first shade is transparent so we only paint shades 1 - 255
    if (params.blank) {
      context.fillStyle = params.face;
      context.fillRect(-scale, -scale, width + 2 * scale, height + 2 * scale);
    } else {
      context.imageSmoothingEnabled = false;
      context.clearRect(0, 0, width, height);
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
        -scale - 0.5 * lineWidth,
        -scale - 0.5 * lineWidth,
        width + 2 * scale + lineWidth,
        height + 2 * scale + lineWidth
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

    // Ticks
    context.font = `${16 * scale}px LabelFont`;
    params.style.ticks.forEach((tick) => {
      let t = Math.floor(tick.pos * xscale) - tickOffset + 0.5 * scale;

      context.lineWidth = lineWidth;
      let meas = context.measureText(tick.text);
      // console.log("meas", meas);
      let xx = t - 0.5 * meas.width;
      let yy = height + 22 * scale;
      context.fillStyle = params.face;
      if (params.blank) {
        context.strokeStyle = params.stroke;
        context.strokeText(tick.text, xx, yy);
      }
      context.fillText(tick.text, xx, yy);

      context.strokeStyle = params.face;
      context.lineWidth = params.blank ? lineWidth + scale : scale;
      context.beginPath();
      context.moveTo(t, height + 2 * scale - 0.5 * context.lineWidth);
      context.lineTo(t, height + 3 * scale + 0.5 * context.lineWidth);
      context.closePath();
      context.stroke();
    });

    // context.lineWidth = 3 * scale;
    // context.strokeStyle = "red";
    // context.strokeRect(10.5, 10.5, 30, 30);

    // context.lineWidth = 1;
    // context.strokeStyle = "black";
    // context.strokeRect(10.5, 10.5, 10, 10);
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

function setCanvasStyle(canvas, gravity) {
  const computedStyle = getComputedStyle(document.body);
  const topbarHeight = computedStyle.getPropertyValue("--topbar-height");

  const setCanvasSize = (width, height) => {
    const scale = window.devicePixelRatio;
    canvas.width = width * scale;
    canvas.height = height * scale;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  };

  if (gravity == "top") {
    setCanvasSize(window.innerWidth, 80);
    canvas.style.top = topbarHeight;
  } else {
    setCanvasSize(130, 550);
    canvas.style.right = "30px";
    canvas.style.bottom = "100px";
  }
}

export function Colorbar(props) {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    setCanvasStyle(canvas, props.gravity);

    if (props.palette === null) return;

    if (props.debug) {
      console.log(props);
      console.debug(
        `drawing ... ${canvas.style.width} x ${canvas.style.height}` +
          ` @ ${window.devicePixelRatio} -> ${canvas.width} x ${canvas.height}`
      );
    }

    const context = canvas.getContext("2d");

    context.clearRect(0, 0, context.canvas.width, context.canvas.height);

    let tint = props.debug ? "#ff9922dd" : props.colors.label.stroke;
    if (props.gravity == "right") {
      context.shadowColor = tint;
      context.shadowBlur = 3 * window.devicePixelRatio;
      draw(context, {
        blank: true,
        gravity: props.gravity,
        palette: props.palette,
        index: props.style.index,
        face: tint,
        stroke: tint,
        style: props.style,
        debug: props.debug,
      });
    }

    context.shadowColor = "rgb(128, 128, 128)";
    context.shadowBlur = 0;
    draw(context, {
      blank: false,
      gravity: props.gravity,
      palette: props.palette,
      index: props.style.index,
      face: props.colors.label.face,
      stroke: tint,
      style: props.style,
      debug: props.debug,
    });
  }, [props.count]);

  var params = {
    id: props.id,
    ref: canvasRef,
  };
  if (props.gravity == "top") params.className = "blur";
  return <canvas {...params} />;
}

Colorbar.defaultProps = {
  gravity: "top",
};

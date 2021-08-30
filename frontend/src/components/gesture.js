//
//  Gesture.js
//  RadarHub
//
//  Created by Boonleng Cheong on 7/17/2021.
//

class Gesture {
  constructor(element, bounds) {
    this.element = element;
    this.bounds = bounds
      ? bounds
      : {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        };
    this.pointX = 0;
    this.pointY = 0;
    this.pointD = 0;
    this.minX = 0;
    this.maxX = 1000;
    this.minY = -32000;
    this.maxY = +32000;
    this.shiftKey = false;
    this.panInProgress = false;
    this.singleTapTimeout = null;
    this.lastMagnifyTime = Date.now();
    this.lastTapTime = Date.now();
    this.message = "gesture";
    this.rect = { x: 0, y: 0, top: 0, left: 0, bottom: 1, right: 1 };
    this.handlePan = (_x, _y) => {};
    this.handleMagnify = (_mx, _my, _x, _y) => {};
    this.handleSingleTap = () => {};
    this.handleDoubleTap = (_x, _y) => {};

    this.element.addEventListener("mousedown", (e) => {
      if (
        e.offsetX > this.bounds.left &&
        e.offsetY < this.element.height - this.bounds.bottom
      ) {
        this.pointX = e.offsetX;
        this.pointY = e.offsetY;
        this.panInProgress = true;
        this.rect = this.element.getBoundingClientRect();
      }
    });
    this.element.addEventListener("mousemove", (e) => {
      e.preventDefault();
      if (this.panInProgress === true || this.shiftKey === true) {
        this.handlePan(e.offsetX - this.pointX, this.pointY - e.offsetY);
      }
      this.pointX = e.offsetX;
      this.pointY = e.offsetY;
      this.shiftKey = e.shiftKey;
      this.message = `mousemove (${this.pointX}, ${this.pointY})`;
    });
    this.element.addEventListener("mouseup", (e) => {
      if (this.panInProgress === true) {
        this.handlePan(e.offsetX - this.pointX, this.pointY - e.offsetY);
      }
      this.pointX = e.offsetX;
      this.pointY = e.offsetY;
      this.panInProgress = false;
    });
    this.element.addEventListener("wheel", (e) => {
      if (
        e.offsetX > this.bounds.left &&
        e.offsetX < this.element.width - this.bounds.right &&
        e.offsetY > this.bounds.top &&
        e.offsetY < this.element.height - this.bounds.bottom
      ) {
        e.preventDefault();
        this.handleMagnify(
          delta2scale(e.deltaX),
          delta2scale(-e.deltaY),
          e.offsetX - this.bounds.left,
          e.offsetY - this.bounds.bottom
        );
      }
      this.message =
        `wheel (${e.offsetX}, ${e.offsetY})` +
        ` x: ${this.bounds.left} <? ${e.offsetX} <? ${
          this.element.width - this.bounds.right
        } y: ${this.bounds.top} <? ${e.offsetY} <? ${
          this.element.height - this.bounds.bottom
        }`;
      this.bounds.top + ", " + this.element.height;
    });
    this.element.addEventListener("touchstart", (e) => {
      let [x, y, u, v] = positionAndDistanceFromTouches(e.targetTouches);
      const rect = this.element.getBoundingClientRect();
      if (
        x - rect.left > this.bounds.left &&
        rect.bottom - y > this.bounds.bottom
      ) {
        e.preventDefault();
        this.panInProgress = true;
      }
      this.pointX = x;
      this.pointY = y;
      this.pointU = u;
      this.pointV = v;
      this.rect = rect;
      this.message = "touchstart";
    });
    this.element.addEventListener("touchend", (e) => {
      if (e.targetTouches.length > 0) {
        let [x, y, u, v] = positionAndDistanceFromTouches(e.targetTouches);
        this.pointX = x;
        this.pointY = y;
        this.pointU = u;
        this.pointV = v;
        return;
      }
      const now = Date.now();
      const delta = now - this.lastTapTime;
      if (this.singleTapTimeout !== null) {
        clearTimeout(this.singleTapTimeout);
        this.singleTapTimeout = null;
      }
      this.panInProgress = false;
      if (delta > 90 && delta < 300 && now - this.lastMagnifyTime > 300) {
        this.message = `touchend: double tap (${delta} ms)`;
        this.handleDoubleTap(this.pointX, this.pointY);
      } else {
        // single tap
        this.message = "touchend: pending single / double";
        this.singleTapTimeout = setTimeout(() => {
          clearTimeout(this.singleTapTimeout);
          this.singleTapTimeout = null;
          this.message = `touchend: single tap (${delta} ms)`;
        }, 300);
      }
      this.lastTapTime = now;
    });
    this.element.addEventListener("touchcancel", (_e) => {
      this.panInProgress = false;
      this.message = "touchcancel";
    });
    this.element.addEventListener("touchmove", (e) => {
      let [x, y, u, v] = positionAndDistanceFromTouches(e.targetTouches);
      if (this.panInProgress === true) {
        e.preventDefault();
        this.handleMagnify(
          delta2scale(0.3 * (this.pointU - u)),
          delta2scale(0.3 * (this.pointV - v)),
          x,
          y
        );
        this.handlePan(x - this.pointX, this.pointY - y);
        this.pointX = x;
        this.pointY = y;
        this.pointU = u;
        this.pointV = v;
      }
      this.message = "touchmove (" + x + ", " + y + ")";
    });
    this.element.addEventListener("dblclick", (e) => {
      this.pointX = e.offsetX;
      this.pointY = e.offsetY;
      this.message = "double click";
      this.handleDoubleTap(this.pointX, this.pointY);
    });
    // this.element.addEventListener("gesturestart", (e) => {
    //   this.message = "gesturestart (" + e.scale + ")";
    //   e.preventDefault();
    //   // if (e.scale > 0) {
    //   //   let s = 0.04 * (e.scale - 1) + 1.0;
    //   //   this.handleMagnify(s, s);
    //   //   e.preventDefault();
    //   // }
    // });
    // this.element.addEventListener("gesturechange", (e) => {
    //   this.message = "gesturechange (" + e.scale + ")";
    //   e.preventDefault();
    //   // if (e.scale > 0) {
    //   //   let s = 0.04 * (e.scale - 1) + 1.0;
    //   //   this.handleMagnify(s, s);
    //   //   e.preventDefault();
    //   // }
    // });
    // this.element.addEventListener("gestureend", (e) => {
    //   this.message = "gestureend (" + e.scale + ")";
    //   e.preventDefault();
    //   // if (e.scale > 0) {
    //   //   let s = 0.04 * (e.scale - 1) + 1.0;
    //   //   this.handleMagnify(s, s);
    //   //   e.preventDefault();
    //   // }
    // });
  }
}

function delta2scale(x) {
  if (x > 3) {
    return 1 / 1.1;
  } else if (x < -3) {
    return 1.1;
  } else if (x > 2) {
    return 1 / 1.05;
  } else if (x < -2) {
    return 1.05;
  } else if (x > 0.2) {
    return 1 / 1.01;
  } else if (x < -0.2) {
    return 1.01;
  }
  return 1;
}

function positionAndDistanceFromTouches(touches) {
  let x, y, u, v;
  if (touches.length > 1) {
    x = 0.5 * (touches[0].clientX + touches[1].clientX);
    y = 0.5 * (touches[0].clientY + touches[1].clientY);
    u = Math.abs(touches[0].clientX - touches[1].clientX);
    v = Math.abs(touches[0].clientY - touches[1].clientY);
  } else {
    x = touches[0].clientX;
    y = touches[0].clientY;
    u = 0;
    v = 0;
  }
  return [x, y, u, v];
}

export { Gesture };

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
    this.pointX = -1;
    this.pointY = -1;
    this.pointU = 0;
    this.pointV = 0;
    this.pointD = 0;
    this.scale = 1;
    this.hasTouch = false;
    this.mouseDown = false;
    this.panInProgress = false;
    this.tiltInProgress = false;
    this.rollInProgress = false;
    this.singleTapTimeout = null;
    this.lastMagnifyTime = Date.now();
    this.lastTapTime = Date.now();
    this.message = "gesture";
    this.rect = { x: 0, y: 0, top: 0, left: 0, bottom: 1, right: 1 };
    this.handlePan = (_x, _y) => {};
    this.handleTilt = (_x, _y) => {};
    this.handleRoll = (_x, _y) => {};
    this.handleSingleTap = (_x, _y) => {};
    this.handleDoubleTap = (_x, _y) => {};
    this.handleMagnify = (_mx, _my, _m, _x, _y) => {};
    this.handleDolly = (_mx, _my, _m, _x, _y) => {};
    this.inbound = this.inbound.bind(this);

    this.element.addEventListener("mousedown", (e) => {
      if (this.inbound(e)) {
        this.pointX = e.offsetX;
        this.pointY = e.offsetY;
        this.rect = this.element.getBoundingClientRect();
        if (e.altKey) {
          this.tiltInProgress = true;
        } else if (e.ctrlKey) {
          this.rollInProgress = true;
        } else {
          this.panInProgress = true;
        }
      }
    });
    this.element.addEventListener("mousemove", (e) => {
      e.preventDefault();
      if (this.panInProgress === true) {
        this.handlePan(e.offsetX - this.pointX, this.pointY - e.offsetY);
      } else if (this.tiltInProgress === true) {
        this.handleTilt(e.offsetX - this.pointX, this.pointY - e.offsetY);
      } else if (this.rollInProgress === true) {
        this.handleRoll(e.offsetX - this.pointX, this.pointY - e.offsetY);
      } else if (this.inbound(e)) {
        if (e.shiftKey) {
          this.panInProgress = true;
          // console.log("pan mode");
        } else if (e.altKey) {
          this.tiltInProgress = true;
          // console.log("tilt mode");
        } else if (e.ctrlKey) {
          this.rollInProgress = true;
        } else {
          this.panInProgress = false;
          this.tiltInProgress = false;
          this.rollInProgress = false;
        }
      } else {
        this.panInProgress = false;
        this.tiltInProgress = false;
        this.rollInProgress = false;
      }
      this.pointX = e.offsetX;
      this.pointY = e.offsetY;
      // this.message = `mousemove (${this.pointX}, ${this.pointY})`;
      // console.log(this.message);
    });
    this.element.addEventListener("focus", (e) => {
      console.log(`focus ${e.offsetX}`);
    });
    // window.addEventListener("keydown", (e) => {
    //   console.log(`keydown ${e.offsetX}, ${e.offsetY}`);
    //   if (this.inbound(e)) {
    //     if (e.metaKey) {
    //       this.tiltInProgress = true;
    //     } else if (e.altKey) {
    //       this.rollInProgress = true;
    //     } else if (e.shiftKey) {
    //       this.panInProgress = true;
    //       console.log("pan mode");
    //     }
    //     this.pointX = e.offsetX;
    //     this.pointY = e.offsetY;
    //   }
    // });
    window.addEventListener("keyup", (e) => {
      // console.log(`keyup ${e.offsetX}, ${e.offsetY}`);
      if (!this.mouseDown) {
        this.panInProgress = false;
        this.tiltInProgress = false;
        this.rollInProgress = false;
      }
    });
    this.element.addEventListener("mouseup", (e) => {
      if (this.panInProgress === true) {
        this.handlePan(e.offsetX - this.pointX, this.pointY - e.offsetY);
      } else if (this.tiltInProgress === true) {
        this.handleTilt(e.offsetX - this.pointX, this.pointY - e.offsetY);
      } else if (this.rollInProgress === true) {
        this.handleRoll(e.offsetX - this.pointX, this.pointY - e.offsetY);
      }
      this.pointX = e.offsetX;
      this.pointY = e.offsetY;
      this.panInProgress = false;
      this.tiltInProgress = false;
      this.rollInProgress = false;
      this.mouseDown = false;
    });
    this.element.addEventListener("wheel", (e) => {
      if (
        e.offsetX > this.bounds.left &&
        e.offsetX < this.element.width - this.bounds.right &&
        e.offsetY > this.bounds.top &&
        e.offsetY < this.element.height - this.bounds.bottom
      ) {
        e.preventDefault();
        if (e.altKey) {
          this.handleMagnify(
            delta2scale(3 * e.deltaX),
            delta2scale(-3 * e.deltaY),
            delta2scale(3 * e.deltaY),
            e.offsetX - this.bounds.left,
            e.offsetY - this.bounds.bottom
          );
        } else {
          this.handleDolly(
            delta2scale(3 * e.deltaX),
            delta2scale(-3 * e.deltaY),
            delta2scale(3 * e.deltaY),
            e.offsetX - this.bounds.left,
            e.offsetY - this.bounds.bottom
          );
        }
      }
      this.message =
        `wheel (${e.offsetX}, ${e.offsetY})` +
        ` x: ${this.bounds.left} < ${e.offsetX} < ${
          this.element.width - this.bounds.right
        } y: ${this.bounds.top} < ${e.offsetY} < ${
          this.element.height - this.bounds.bottom
        }`;
      this.bounds.top + ", " + this.element.height;
    });
    this.element.addEventListener("touchstart", (e) => {
      let [x, y, u, v, d] = positionAndDistanceFromTouches(e.targetTouches);
      const rect = this.element.getBoundingClientRect();
      if (
        x - rect.left > this.bounds.left &&
        rect.bottom - y > this.bounds.bottom
      ) {
        e.preventDefault();
        this.panInProgress = true;
        if (e.targetTouches.length == 2) {
          this.tiltInProgress = true;
          console.log("touchstart -> tiltInProgress = true");
        }
      }
      this.pointX = x;
      this.pointY = y;
      this.pointU = u;
      this.pointV = v;
      this.pointD = d;
      this.scale = 1;
      this.rect = rect;
      this.hasTouch = true;
      this.message = "touchstart";
    });
    this.element.addEventListener("touchend", (e) => {
      if (e.targetTouches.length > 0) {
        let [x, y, u, v, d] = positionAndDistanceFromTouches(e.targetTouches);
        if (e.targetTouches.length < 2) {
          this.tiltInProgress = false;
          console.log("touchend -> tiltInProgress = false");
        }
        this.pointX = x;
        this.pointY = y;
        this.pointU = u;
        this.pointV = v;
        this.pointD = d;
        return;
      }
      const now = Date.now();
      const delta = now - this.lastTapTime;
      if (this.singleTapTimeout !== null) {
        clearTimeout(this.singleTapTimeout);
        this.singleTapTimeout = null;
      }
      this.panInProgress = false;
      this.tiltInProgress = false;
      this.rollInProgress = false;
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
      this.tiltInProgress = false;
      this.rollInProgress = false;
      this.message = "touchcancel";
    });
    this.element.addEventListener("touchmove", (e) => {
      let [x, y, u, v, d] = positionAndDistanceFromTouches(e.targetTouches);
      let s = 1.0;
      let m = "";
      if (this.tiltInProgress === true) {
        e.preventDefault();
        if (e.targetTouches.length == 1) {
          this.tiltInProgress = false;
        } else if (e.targetTouches.length == 2) {
          this.tiltInProgress = true;
          if (e.scale) {
            s = e.scale / this.scale;
            this.scale = e.scale;
            m = "s";
          } else if (d > 10) {
            s = d / this.pointD;
            m = "d";
          }
          this.handleDolly(
            u > 10 ? u / this.pointU : 1,
            v > 10 ? v / this.pointV : 1,
            s,
            x,
            y
          );
        }
        this.handleTilt(x - this.pointX, this.pointY - y);
        this.pointX = x;
        this.pointY = y;
        this.pointU = u;
        this.pointV = v;
        this.pointD = d;
      } else if (this.panInProgress === true) {
        e.preventDefault();
        if (e.targetTouches.length == 2) {
          if (e.scale) {
            s = e.scale / this.scale;
            this.scale = e.scale;
            m = "s";
          } else if (d > 10) {
            s = d / this.pointD;
            m = "d";
          }
          this.handleDolly(
            u > 10 ? u / this.pointU : 1,
            v > 10 ? v / this.pointV : 1,
            s,
            x,
            y
          );
        }
        this.handlePan(x - this.pointX, this.pointY - y);
        this.pointX = x;
        this.pointY = y;
        this.pointU = u;
        this.pointV = v;
        this.pointD = d;
      }
      this.message = `touchmove (${x}, ${y}) / ${s.toFixed(4)}${m} `;
    });
    this.element.addEventListener("dblclick", (e) => {
      this.pointX = e.offsetX;
      this.pointY = e.offsetY;
      this.message = "double click";
      this.handleDoubleTap(this.pointX, this.pointY);
    });
    this.element.addEventListener("gesturestart", (e) => {
      if (this.hasTouch) return;
      this.message += `gesturestart (${e.scale.toFixed(4)})`;
      e.preventDefault();
      this.scale = e.scale;
    });
    this.element.addEventListener("gesturechange", (e) => {
      if (this.hasTouch) return;
      this.message = `gesturechange (${e.scale.toFixed(4)})`;
      e.preventDefault();
      const s = e.scale / this.scale;
      //this.handleMagnify(s, s, s, e.clientX, e.clientY);
      this.handleDolly(s, s, s, e.clientX, e.clientY);
      this.scale = e.scale;
    });
    this.element.addEventListener("gestureend", (e) => {
      if (this.hasTouch) return;
      this.message = `gestureend (${e.scale.toFixed(4)})`;
      e.preventDefault();
      const s = e.scale / this.scale;
      // this.handleMagnify(s, s, s, e.clientX, e.clientY);
      this.handleDolly(s, s, s, e.clientX, e.clientY);
      this.scale = e.scale;
    });
  }

  inbound(e) {
    return (
      e.offsetX > this.bounds.left &&
      e.offsetY < this.element.height - this.bounds.bottom
    );
  }
}

function delta2scale(x) {
  if (x > +10) return 1 / 1.1;
  if (x < -10) return 1.1;
  if (x > +5) return 1 / 1.05;
  if (x < -5) return 1.05;
  if (x > +1) return 1 / 1.01;
  if (x < -1) return 1.01;
  return 1;
}

function positionAndDistanceFromTouches(touches) {
  let x, y, u, v, d;
  if (touches.length > 1) {
    x = 0.5 * (touches[0].clientX + touches[1].clientX);
    y = 0.5 * (touches[0].clientY + touches[1].clientY);
    u = Math.abs(touches[0].clientX - touches[1].clientX);
    v = Math.abs(touches[0].clientY - touches[1].clientY);
    d = Math.sqrt(u * u + v * v);
  } else {
    x = touches[0].clientX;
    y = touches[0].clientY;
    u = 0;
    v = 0;
    d = 0;
  }
  // console.log(`(x, y) = (${x}, ${y})`);
  return [x, y, u, v, d];
}

export { Gesture };

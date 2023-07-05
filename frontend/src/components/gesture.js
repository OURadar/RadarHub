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
    this.tick = 0;
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
    this.setTilt = this.setTilt(this);

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
    this.element.addEventListener(
      "wheel",
      (e) => {
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
          ` x: ${this.bounds.left} < ${e.offsetX} < ${this.element.width - this.bounds.right} y: ${this.bounds.top} < ${
            e.offsetY
          } < ${this.element.height - this.bounds.bottom}`;
        this.bounds.top + ", " + this.element.height;
      },
      { passive: false }
    );
    this.element.addEventListener(
      "touchstart",
      (e) => {
        let [x, y, u, v, d] = positionAndDistanceFromTouches(e.targetTouches);
        const rect = this.element.getBoundingClientRect();
        if (x - rect.left > this.bounds.left && rect.bottom - y > this.bounds.bottom) {
          e.preventDefault();
          this.panInProgress = true;
          if (e.targetTouches.length == 3) {
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
      },
      { passive: false }
    );
    this.element.addEventListener("touchend", (e) => {
      if (e.targetTouches.length > 0) {
        let [x, y, u, v, d] = positionAndDistanceFromTouches(e.targetTouches);
        this.pointX = x;
        this.pointY = y;
        this.pointU = u;
        this.pointV = v;
        this.pointD = d;
        if (e.targetTouches.length < 2) {
          this.tiltInProgress = false;
          this.rollInProgress = false;
        }
        return;
      } else {
        this.tick = 0;
        this.panInProgress = false;
        this.tiltInProgress = false;
        this.rollInProgress = false;
      }
      const now = Date.now();
      const delta = now - this.lastTapTime;
      if (this.singleTapTimeout !== null) {
        clearTimeout(this.singleTapTimeout);
        this.singleTapTimeout = null;
      }
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
    this.element.addEventListener(
      "touchmove",
      (e) => {
        let [x, y, u, v, d] = positionAndDistanceFromTouches(e.targetTouches);
        let s = 1.0;
        let m = "";
        let dx = x - this.pointX;
        let dy = this.pointY - y;
        if (this.tiltInProgress === true) {
          e.preventDefault();
          this.handleTilt(dx, dy);
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
            this.handleDolly(u > 10 ? u / this.pointU : 1, v > 10 ? v / this.pointV : 1, s, x, y);
          }
          if (e.targetTouches.length == 2 && this.tick < 3 && dy > 1.0 && s < 1.02 && d < 150) {
            // console.log(
            //   `tick = ${this.tick}  touches = ${e.targetTouches.length}  dy = ${dy}   s = ${s}  d = ${d}`
            // );
            this.tiltInProgress = true;
            this.handleTilt(dx, dy);
          } else {
            this.handlePan(dx, dy);
          }
          this.pointX = x;
          this.pointY = y;
          this.pointU = u;
          this.pointV = v;
          this.pointD = d;
        }
        this.message = `touchmove (${x}, ${y}) / ${s.toFixed(4)}${m} `;
        this.tick++;
        // console.log(`tick = ${this.tick}`);
      },
      { passive: false }
    );
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
    return e.offsetX > this.bounds.left && e.offsetY < this.element.height - this.bounds.bottom;
  }

  setTilt(mode) {
    this.tiltInProgress = mode;
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
  if (touches.length == 2) {
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

class Scroller {
  constructor(element, axis = "y") {
    this.element = element;
    this.axis = axis;
    this.tick = 0;
    this.pointX = -1;
    this.pointY = -1;
    this.pointU = 0;
    this.pointV = 0;
    this.timeStamp = 0;
    this.velocityX = 0;
    this.velocityY = 0;
    this.bx = [0, 0, 0];
    this.by = [0, 0, 0];
    this.bt = [0, 0, 0];
    this.ib = 0;
    this.nb = 0;
    this.motionInterval = null;
    this.hasTouch = false;
    this.mouseDown = false;
    this.panInProgress = false;
    this.singleTapTimeout = null;
    this.lastTapTime = Date.now();
    this.stretch = 0;
    this.message = "scroll";
    this.rect = { x: 0, y: 0, top: 0, left: 0, bottom: 1, right: 1 };
    this.handlePan = (_x, _y) => {};
    this.handlePanX = (_x) => {};
    this.handlePanY = (_y) => {};
    this.handleSingleTap = (_x, _y) => {};
    this.handleDoubleTap = (_x, _y) => {};

    this.setHandler = this.setHandler.bind(this);
    this.pan = this.pan.bind(this);

    this.element.addEventListener(
      "wheel",
      (e) => {
        // console.log(`Scroller.onWheel ${e.deltaY}`);
        if (Math.abs(e.deltaY) < 2) {
          this.panInProgress = false;
          this.stretch = 0;
        } else {
          this.panInProgress = true;
        }
        this.pan(-e.deltaY);
      },
      { passive: false }
    );

    this.element.addEventListener(
      "touchmove",
      (e) => {
        let dy = e.touches[0].clientY - this.pointY;
        let dt = e.timeStamp - this.timeStamp;
        // console.log(`dt = ${dt}`);
        if (this.motionInterval == null) {
          this.by[this.ib] = dy;
          this.bt[this.ib] = dt;
          this.nb = this.nb == 3 ? 3 : this.nb + 1;
          this.ib = this.ib == 2 ? 0 : this.ib + 1;
          this.velocityY = (this.by[0] + this.by[1] + this.by[2]) / this.nb;
        }
        this.pointX = e.touches[0].clientX;
        this.pointY = e.touches[0].clientY;
        this.timeStamp = e.timeStamp;
        this.panInProgress = true;
        this.pan(dy);
      },
      { passive: false }
    );
    this.element.addEventListener(
      "touchstart",
      (e) => {
        if (this.motionInterval) {
          clearInterval(this.motionInterval);
          this.motionInterval = null;
        }
        // console.log(e.timeStamp);
        this.pointX = e.touches[0].clientX;
        this.pointY = e.touches[0].clientY;
        this.timeStamp = e.timeStamp;
        this.by = [0, 0, 0];
        this.bt = [0, 0, 0];
        this.nb = 0;
        this.ib = 0;
      },
      { passive: false }
    );
    this.element.addEventListener("touchend", (e) => {
      if (this.nb < 3) {
        return;
      }
      let period = (this.bt[0] + this.bt[1] + this.bt[2]) / this.nb;
      this.motionInterval = setInterval(() => {
        this.pan(this.velocityY);
        this.velocityX *= 0.93;
        this.velocityY *= 0.93;
        if (this.velocityY > -0.25 && this.velocityY < 0.25) {
          clearInterval(this.motionInterval);
          this.motionInterval = null;
          this.panInProgress = false;
          this.stretch = 0;
        }
      }, period);
    });
    this.element.addEventListener("touchcancel", (e) => console.log(e.touches));

    console.log("Scroller init");
  }

  pan(delta) {
    if (this.stretch <= 1) {
      console.log(`Scroller.pan(${delta})`);
      this.handlePanY(delta);
    } else if (this.stretch > 5) {
      let dy = Math.max(0.25, 1.0 - 0.05 * this.stretch) * delta;
      console.log(`stretch = ${this.stretch.toFixed(2)}  panY ${dy}`);
      this.handlePanY(dy);
    } else if (this.stretch > 20) {
      this.handlePanY(delta > 0 ? 0.5 : -0.5);
    } else if (this.stretch > 50) {
      return;
    }
  }

  setHandler(f) {
    this.handlePanY = f;
  }

  addStretch() {
    console.log(`Scroller.addStretch`);
    this.stretch++;
  }

  resetStretch() {
    console.log(`Scroller.resetStretch`);
    this.stretch = 0;
  }
}

export { Gesture, Scroller };

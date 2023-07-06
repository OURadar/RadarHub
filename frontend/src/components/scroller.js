class Scroller {
  constructor(element) {
    this.element = element;
    this.position = 0;
    this.velocity = 0;
    this.timeStamp = 0;
    this.bx = [0, 0, 0];
    this.by = [0, 0, 0];
    this.bt = [0, 0, 0];
    this.ib = 0;
    this.nb = 0;
    this.counter = 0;
    this.coasting = false;
    this.bouncing = false;
    this.interval = null;
    this.distance = 0;
    this.stretch = 0;
    this.message = "scroll";
    this.rect = { x: 0, y: 0, top: 0, left: 0, bottom: 1, right: 1 };
    this.handlePan = (_x, _y) => {};
    this.handleQuery = (_x) => 0;

    this.pan = this.pan.bind(this);

    this.setHandler = this.setHandler.bind(this);
    this.setReporter = this.setReporter.bind(this);

    this.addStretch = this.addStretch.bind(this);
    this.resetStretch = this.resetStretch.bind(this);

    this.handleTouchEndCancel = (e) => {
      if (this.nb < 2 || Math.abs(this.velocity) < 2) {
        this.distance = this.handleQuery(this.velocity);
        if (this.distance != 0 && this.stretch) {
          this.bounce();
        }
        return;
      }
      let period = (this.bt[0] + this.bt[1] + this.bt[2]) / this.nb;
      this.counter = 0;
      this.coasting = true;
      this.interval = setInterval(() => {
        this.distance = this.handleQuery(this.velocity);
        this.pan(this.velocity);
        if (this.velocity > -0.3 && this.velocity < 0.3) {
          clearInterval(this.interval);
          this.interval = null;
          this.coasting = false;
          this.counter = 0;
          // console.log(`touchend velocity ~ 0 ${this.velocityY}, ${this.overdrive} ${this.stretch}`);
          if (this.distance != 0 && this.stretch) {
            this.bounce();
          }
        }
        if (this.stretch) {
          if (this.counter++ > 6) {
            this.velocity *= 0.1;
          } else {
            this.velocity *= 0.7;
          }
        } else {
          this.velocity *= 0.95;
        }
      }, period);
    };

    this.element.addEventListener(
      "wheel",
      (e) => {
        // console.log(`Scroller.onWheel ${e.deltaY}`);
        e.preventDefault();
        if (this.bouncing) {
          return;
        }
        this.distance = this.handleQuery(-e.deltaY);
        // console.log(`Scroller.onWheel ${e.deltaY} ${this.stretch}`);
        if (Math.abs(this.distance) > 30 && this.stretch && Math.abs(e.deltaY) < 5) {
          e.stopImmediatePropagation();
          e.stopPropagation();
          this.bounce();
        } else if (this.stretch > 25) {
          this.pan(-0.5 * e.deltaY);
        } else if (this.stretch > 10) {
          this.pan(-0.6 * e.deltaY);
        } else if (this.stretch > 5) {
          this.pan(-0.7 * e.deltaY);
        } else {
          this.pan(-e.deltaY);
        }
      },
      { passive: false }
    );

    this.element.addEventListener(
      "touchmove",
      (e) => {
        let dy = e.touches[0].clientY - this.position;
        let dt = e.timeStamp - this.timeStamp;
        // console.log(`dt = ${dt}`);
        if (this.interval == null) {
          this.by[this.ib] = dy;
          this.bt[this.ib] = dt;
          this.nb = this.nb == 3 ? 3 : this.nb + 1;
          this.ib = this.ib == 2 ? 0 : this.ib + 1;
          this.velocity = (this.by[0] + this.by[1] + this.by[2]) / this.nb;
        }
        this.position = e.touches[0].clientY;
        this.timeStamp = e.timeStamp;
        this.distance = this.handleQuery(this.velocity);
        this.pan(dy);
      },
      { passive: false }
    );
    this.element.addEventListener(
      "touchstart",
      (e) => {
        if (this.interval) {
          clearInterval(this.interval);
          this.interval = null;
        }
        // console.log(e.timeStamp);
        this.position = e.touches[0].clientY;
        this.timeStamp = e.timeStamp;
        this.by = [0, 0, 0];
        this.bt = [0, 0, 0];
        this.nb = 0;
        this.ib = 0;
      },
      { passive: false }
    );
    this.element.addEventListener("touchend", this.handleTouchEndCancel);
    this.element.addEventListener("touchcancel", this.handleTouchEndCancel);

    console.log("Scroller init");
  }

  pan(delta) {
    const stress = Math.abs(this.distance);
    if (this.coasting || stress < 80) {
      this.handlePan(delta);
    } else if (stress < 160) {
      this.handlePan(0.5 * delta);
    } else if (stress < 320) {
      this.handlePan(0.25 * delta);
    }
  }

  bounce() {
    this.bouncing = true;
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.interval = setInterval(() => {
      if (Math.abs(this.distance) < 1) {
        clearInterval(this.interval);
        this.interval = null;
        this.bouncing = false;
        this.distance = 0;
        this.stretch = 0;
      }
      this.handlePan(-0.2 * this.distance);
      this.distance -= 0.2 * this.distance;
    }, 16);
  }

  setHandler(f) {
    this.handlePan = f;
  }

  setReporter(f) {
    this.handleQuery = f;
  }

  addStretch() {
    if (!this.bouncing) {
      // console.log(`Scroller.addStretch`);
      this.stretch++;
    }
  }

  resetStretch() {
    if (this.stretch != 0 && !this.bouncing) {
      // console.log(`Scroller.resetStretch`);
      this.stretch = 0;
    }
  }
}

export { Scroller };

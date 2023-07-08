class Scroller {
  constructor(element) {
    this.element = element;
    this.position = 0;
    this.velocity = 0;
    this.timeStamp = 0;
    this.bx = [0, 0, 0];
    this.bd = [0, 0, 0];
    this.bt = [0, 0, 0];
    this.ib = 0;
    this.nb = 0;
    this.counter = 0;
    this.coasting = false;
    this.bouncing = false;
    this.distance = 0;
    this.stretch = 0;
    this.timer = null;
    this.last = false;
    this.rect = { x: 0, y: 0, top: 0, left: 0, bottom: 1, right: 1 };
    this.message = "scroll";

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
      this.timer = setInterval(() => {
        this.distance = this.handleQuery(this.velocity);
        this.pan(this.velocity);
        if (this.velocity > -0.3 && this.velocity < 0.3) {
          clearInterval(this.timer);
          this.timer = null;
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
        this.bd[this.ib] = e.deltaY;
        this.nb = this.nb == 3 ? 3 : this.nb + 1;
        this.velocity = (this.bd[0] + this.bd[1] + this.bd[2]) / this.nb;
        this.interval = (this.bt[0] + this.bt[1] + this.bt[2]) / this.nb;
        this.distance = this.handleQuery(-e.deltaY);
        this.ib = this.ib == 2 ? 0 : this.ib + 1;
        if (this.last != 0) {
          if (this.last * e.deltaY > 0) {
            // console.debug(`wheel - ignore and same dir, returning`);
            return;
          } else {
            // console.debug(`wheel - changing dir, continuing ...`);
            this.last = 0;
          }
          if (Math.abs(this.velocity) < 2) {
            // console.debug(`wheel - decelerated enough`);
            this.last = 0;
          }
        }
        if (this.stretch > 3 && Math.abs(this.distance) > 0.5) {
          e.stopImmediatePropagation();
          e.stopPropagation();
          this.last = e.deltaY;
          this.bd = [0, 0, 0];
          this.bt = [0, 0, 0];
          this.nb = 0;
          this.ib = 0;
          this.bounce();
        } else if (this.stretch < 3) {
          this.handlePan(-e.deltaY);
        } else {
          let a = 0.1 + 0.7 ** (0.5 * this.stretch);
          this.handlePan(-a * e.deltaY);
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
        if (this.timer == null) {
          this.bd[this.ib] = dy;
          this.bt[this.ib] = dt;
          this.nb = this.nb == 3 ? 3 : this.nb + 1;
          this.ib = this.ib == 2 ? 0 : this.ib + 1;
          this.velocity = (this.bd[0] + this.bd[1] + this.bd[2]) / this.nb;
          this.interval = (this.bt[0] + this.bt[1] + this.bt[2]) / this.nb;
          this.distance = this.handleQuery(this.velocity);
        }
        this.position = e.touches[0].clientY;
        this.timeStamp = e.timeStamp;
        if (this.stretch) {
          let a = 0.8 ** (0.25 * this.stretch);
          this.pan(a * dy);
        } else {
          this.pan(dy);
        }
      },
      { passive: false }
    );
    this.element.addEventListener(
      "touchstart",
      (e) => {
        if (this.timer) {
          clearInterval(this.timer);
          this.timer = null;
        }
        // console.log(e.timeStamp);
        this.position = e.touches[0].clientY;
        this.timeStamp = e.timeStamp;
        this.bd = [0, 0, 0];
        this.bt = [0, 0, 0];
        this.nb = 0;
        this.ib = 0;
      },
      { passive: false }
    );
    this.element.addEventListener("touchend", this.handleTouchEndCancel);
    this.element.addEventListener("touchcancel", this.handleTouchEndCancel);
  }

  pan(delta) {
    this.handlePan(delta);
  }

  bounce() {
    this.bouncing = true;
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.timer = setInterval(() => {
      if (Math.abs(this.distance) < 1) {
        clearInterval(this.timer);
        this.timer = null;
        this.bouncing = false;
        this.distance = 0;
        this.stretch = 0;
      }
      const d = -0.2 * this.distance;
      this.handlePan(d);
      this.distance += d;
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
      // console.log(`Scroller.addStretch ${this.stretch}`);
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

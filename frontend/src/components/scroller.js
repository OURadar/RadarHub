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
    this.overdrive = 0;
    this.coasting = false;
    this.bouncing = false;
    this.motionInterval = null;
    this.stretch = 0;
    this.message = "scroll";
    this.rect = { x: 0, y: 0, top: 0, left: 0, bottom: 1, right: 1 };
    this.handlePan = (_x, _y) => {};
    this.handlePanX = (_x) => {};
    this.handlePanY = (_y) => {};
    this.handleQuery = () => 0;

    this.pan = this.pan.bind(this);

    this.setHandler = this.setHandler.bind(this);
    this.setReporter = this.setReporter.bind(this);

    this.addStretch = this.addStretch.bind(this);
    this.resetStretch = this.resetStretch.bind(this);

    this.element.addEventListener(
      "wheel",
      (e) => {
        // console.log(`Scroller.onWheel ${e.deltaY}`);
        if (this.bouncing) {
          return;
        }
        this.overdrive = this.handleQuery();
        if (Math.abs(this.overdrive) > 50 && this.stretch) {
          this.bounce();
        } else {
          this.pan(-e.deltaY);
        }
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
      if (this.nb < 3 || Math.abs(this.velocityY) < 3) {
        this.overdrive = this.handleQuery();
        if (this.overdrive != 0 && this.stretch) {
          this.bounce();
        }
        return;
      }
      let period = (this.bt[0] + this.bt[1] + this.bt[2]) / this.nb;
      this.coasting = true;
      this.motionInterval = setInterval(() => {
        this.pan(this.velocityY);
        if (this.stretch) {
          this.velocityX *= 0.84;
          this.velocityY *= 0.84;
        } else {
          this.velocityX *= 0.93;
          this.velocityY *= 0.93;
        }
        if (this.velocityY > -0.25 && this.velocityY < 0.25) {
          clearInterval(this.motionInterval);
          this.motionInterval = null;
          this.coasting = false;
          //   this.overdrive = this.handleQuery();
          console.log(`touchend velocity ~ 0, ${this.overdrive} ${this.stretch}`);
          if (this.overdrive != 0 && this.stretch) {
            this.bounce();
          }
        }
      }, period);
    });
    this.element.addEventListener("touchcancel", (e) => console.log(e.touches));

    console.log("Scroller init");
  }

  pan(delta) {
    this.overdrive = this.handleQuery();
    const stress = Math.abs(this.overdrive);
    if (this.coasting || stress < 80) {
      this.handlePanY(delta);
    } else if (stress < 160) {
      this.handlePanY(0.5 * delta);
    } else if (stress < 320) {
      this.handlePanY(0.25 * delta);
    }
  }

  bounce() {
    if (this.motionInterval) {
      clearInterval(this.motionInterval);
    }
    this.motionInterval = setInterval(() => {
      if (Math.abs(this.overdrive) < 1) {
        clearInterval(this.motionInterval);
        this.bouncing = false;
        this.motionInterval = null;
        this.overdrive = 0;
        this.stretch = 0;
      }
      this.handlePanY(-0.2 * this.overdrive);
      this.overdrive -= 0.2 * this.overdrive;
    }, 16);
    this.bouncing = true;
  }

  setHandler(f) {
    this.handlePanY = f;
  }

  setReporter(f) {
    this.handleQuery = f;
  }

  addStretch() {
    if (!this.bouncing) {
      console.log(`Scroller.addStretch`);
      this.stretch++;
    }
  }

  resetStretch() {
    if (this.stretch != 0 && !this.coasting) {
      console.log(`Scroller.resetStretch`);
      this.stretch = 0;
    }
  }
}

export { Scroller };

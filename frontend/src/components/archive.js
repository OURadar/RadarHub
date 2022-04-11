//
//  archive.js
//  RadarHub
//
//  Created by Boonleng Cheong on 9/23/2021.
//

class Archive {
  constructor(radar) {
    this.radar = radar;
    this.grid = {
      dateTimeString: "20130520-1900",
      dailyAvailability: {},
      hourlyAvailability: new Array(24).fill(0),
      latestHour: -1,
      fileListGrouped: {},
      fileList: [],
      symbol: "Z",
      index: -1,
      hour: -1,
      day: new Date("2013/05/20"),
    };
    this.data = {
      sweep: null,
    };
    this.state = {
      liveUpdate: false,
      dailyAvailabilityUpdating: false,
      hourlyAvailabilityUpdating: false,
      fileListUpdating: true,
      switchingProduct: false,
      sweepLoading: false,
      loadCount: 0,
      tic: 0,
    };
    this.timer = null;
    this.message = "";
    this.response = "";
    this.onupdate = () => {};
    this.onlist = () => {};

    this.worker = new Worker("/static/frontend/archive.js?name=levi");
    this.worker.onmessage = ({ data: { type, payload } }) => {
      if (type == "message") {
        this.showMessage(payload, 2500);
      } else if (type == "load") {
        this.data.sweep = payload;
        this.state.sweepLoading = false;
        console.log(
          `%carchive.onmessage()%c "load"` +
            `   hour = ${this.grid.hour}` +
            `   latestHour = ${this.grid.latestHour}` +
            `   loadCount = ${this.state.loadCount}`,
          "color: deeppink",
          "color: inherit"
        );
        if (
          this.grid.latestHour != this.grid.hour ||
          this.state.loadCount > 1
        ) {
          this.disableLiveUpdate();
        }
        this.showMessage(`${payload.name} loaded`);
      } else if (type == "list") {
        this.state.fileListUpdating = false;
        this.state.loadCount = 0;
        console.log(
          `%carchive.onmessage()%c "list"` +
            `   dateTimeString = ${this.grid.dateTimeString}` +
            `   latestHour = ${this.grid.latestHour} -> ${payload.latestHour}` +
            `   hour = ${this.grid.hour} -> ${payload.hour}` +
            `   index = ${this.grid.index} -> ${payload.index}`,
          "color: deeppink",
          "color: inherit"
        );
        let hour = this.grid.hour;
        let index = this.grid.index;
        this.grid = payload;
        if (this.state.liveUpdate) {
          if (hour != this.grid.hour || index != this.grid.index) {
            this.load(this.grid.index);
          } else if (this.state.switchingProduct) {
            this.state.switchingProduct = false;
            this.load(this.grid.index);
          }
        }
      } else if (type == "count") {
        this.grid.hourlyAvailability = payload;
        this.state.hourlyAvailabilityUpdating = false;
      } else if (type == "month") {
        this.grid.dailyAvailability = payload;
        this.state.dailyAvailabilityUpdating = false;
      } else if (type == "reset") {
        this.showMessage(payload);
        this.data.sweep = null;
        this.grid.index = -1;
        this.state.sweepLoading = false;
      } else if (type == "state") {
        if (payload.state == "connect") {
          this.state.liveUpdate = true;
        } else if (payload.state == "disconnect") {
          this.state.liveUpdate = false;
        }
        this.showMessage(payload.message, 2500);
      }
      this.onupdate(this.state.tic++);
    };

    // console.log(this.worker.data);

    this.showMessage = this.showMessage.bind(this);
    this.month = this.month.bind(this);
    this.count = this.count.bind(this);
    this.list = this.list.bind(this);
    this.load = this.load.bind(this);

    this.worker.postMessage({ task: "connect", name: radar });
  }

  showMessage(message, duration = 2000) {
    this.message = message;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (this.message == message) {
        this.message = "";
        this.timer = null;
        this.onupdate(this.state.tic++);
      }
    }, duration);
  }

  // Expect something like radar = px1000, day = 201305
  month(radar, day) {
    this.state.dailyAvailabilityUpdating = true;
    this.worker.postMessage({ task: "month", name: radar, day: day });
    this.onupdate(this.state.tic++);
  }

  // Expect something like radar = raxpol, day = Date('2013-05-20')
  count(radar, day) {
    console.log(
      `%carchive.count()%c   day = ${day}`,
      "color: deeppink",
      "color: inherit"
    );
    // if (this.grid.day == day) {
    //   console.log(
    //     `%carchive.count()%c same day, do nothing`,
    //     "color: deeppink",
    //     "color: inherit"
    //   );
    //   return;
    // }
    this.state.hourlyAvailabilityUpdating = true;
    this.worker.postMessage({ task: "count", name: radar, day: day });
    this.onupdate(this.state.tic++);
  }

  // Expect something like radar = px1000, day = Date('2013-05-20'), hour = 19
  list(radar, day, hour, symbol) {
    console.log(
      `%carchive.list()%c   day = ${day}   hour = ${hour}   symbol = ${symbol} / ${this.grid.symbol}`,
      "color: deeppink",
      "color: inherit"
    );
    if (
      day == this.grid.day &&
      hour == this.grid.hour &&
      symbol == this.grid.symbol
    ) {
      console.log(
        `%carchive.list()%c same day, hour & symbol, do nothing`,
        "color: deeppink",
        "color: inherit"
      );
      return;
    }
    this.radar = radar;
    this.state.fileListUpdating = true;
    this.worker.postMessage({
      task: "list",
      name: radar,
      day: day,
      hour: hour,
      symbol: symbol,
    });
    this.onupdate(this.state.tic++);
  }

  load(arg) {
    this.state.sweepLoading = true;
    if (Number.isInteger(arg)) {
      this.loadByIndex(arg);
    } else {
      this.loadByName(arg);
    }
  }

  loadByIndex(index = -1) {
    if (index < 0 || index >= this.grid.fileList.length) {
      console.log(
        `archive.load() index = ${index} is out of range ${this.grid.fileList.length}.`
      );
      console.log(this.grid.fileList);
      return;
    }
    this.grid.index = index;
    this.loadByName(this.grid.fileList[index]);
  }

  loadByName(name = "PX-20130520-195944-E2.6-Z.nc") {
    this.message = `Loading ${name} ...`;
    this.state.loadCount++;
    this.worker.postMessage({ task: "load", name: name });
    this.onupdate(this.state.tic++);
  }

  switch(symbol = "Z") {
    if (this.grid.index == -1 || this.grid.fileList.length == 0) {
      console.log("No file list just yet");
      return;
    }
    if (symbol == this.data.symbol) {
      console.log("No change in symbol");
      return;
    }
    this.state.switchingProduct = true;
    this.list(this.radar, this.grid.day, this.grid.hour, symbol);
  }

  disableLiveUpdate() {
    this.worker.postMessage({ task: "disconnect", name: this.radar });
  }

  enableLiveUpdate() {
    this.worker.postMessage({ task: "connect", name: this.radar });
  }

  toggleLiveUpdate() {
    if (this.state.liveUpdate) {
      this.disableLiveUpdate();
    } else {
      // this.list(
      //   this.radar,
      //   this.grid.day,
      //   this.grid.latestHour,
      //   this.grid.symbol
      // );
      // this.enableLiveUpdate();
      this.worker.postMessage({ task: "catchup", name: this.radar });
    }
  }
}

export { Archive };

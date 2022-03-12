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
      dailyAvailability: {},
      hourlyAvailability: new Array(24).fill(0),
      dateTimeString: "20130520-1900",
      fileListGrouped: {},
      fileList: [],
      index: -1,
      hour: -1,
      day: new Date("2013/05/20"),
    };
    this.data = {
      sweep: null,
      symbol: "Z",
    };
    this.state = {
      liveUpdate: true,
      dailyAvailabilityUpdating: false,
      hourlyAvailabilityUpdating: false,
      fileListUpdating: true,
      resetLoadCount: true,
      loadCountSinceList: 0,
      busyLoading: false,
    };
    this.tic = 0;
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
        this.state.busyLoading = false;
        this.showMessage(`${payload.name} loaded`);
      } else if (type == "list") {
        this.grid.hourlyAvailability = payload.hourlyAvailability;
        this.grid.dateTimeString = payload.dateTimeString;
        this.grid.day = payload.day;
        this.grid.hour = payload.hour;
        this.grid.fileList = payload.fileList;
        this.grid.fileListGrouped = payload.fileListGrouped;
        this.state.fileListUpdating = false;
        // console.log(
        //   `%cworker.onmessage()%c  dateTimeString = ${this.data.dateTimeString}`
        //    + `   hour = ${this.data.hour}   index = ${this.data.index}`,
        //   "color: lightseagreen",
        //   "color: inherit"
        // );
        if (this.state.resetLoadCount) {
          this.state.loadCountSinceList = 0;
          this.onlist(payload.hour, payload.index);
        } else {
          this.state.resetLoadCount = true;
          this.onlist(this.grid.hour, this.grid.index);
        }
      } else if (type == "count") {
        this.grid.hourlyAvailability = payload;
        this.grid.hourlyAvailabilityUpdating = false;
      } else if (type == "month") {
        this.grid.dailyAvailability = payload;
        this.state.dailyAvailabilityUpdating = false;
      } else if (type == "reset") {
        this.showMessage(payload);
        this.data.sweep = null;
        this.grid.index = -1;
        this.state.busyLoading = false;
      }
      this.onupdate(this.tic++);
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
        this.onupdate(this.tic++);
      }
    }, duration);
  }

  // Expect something like radar = px1000, day = 201305
  month(radar, day) {
    this.state.dailyAvailabilityUpdating = true;
    this.worker.postMessage({ task: "month", name: radar, day: day });
    this.onupdate(this.tic++);
  }

  // Expect something like radar = raxpol, day = Date('2013-05-20')
  count(radar, day) {
    console.log(
      `%carchive.count()%c   day = ${day}`,
      "color: deeppink",
      "color: inherit"
    );
    if (this.grid.day == day) {
      console.log(
        `%carchive.count()%c same day, do nothing`,
        "color: deeppink",
        "color: inherit"
      );
      return;
    }
    let tmp = day.toISOString();
    let y = parseInt(tmp.slice(0, 4));
    if (y < 2012) {
      console.log("No data prior to 2013");
      return;
    }
    let dayString = tmp.slice(0, 10).replace(/-/g, "");
    this.grid.hourlyAvailabilityUpdating = true;
    this.worker.postMessage({ task: "count", name: radar, day: dayString });
    this.onupdate(this.tic++);
  }

  // Expect something like radar = px1000, day = Date('2013-05-20'), hour = 19
  list(radar, day, hour) {
    console.log(
      `%carchive.list()%c   day = ${day}   hour = ${hour}`,
      "color: deeppink",
      "color: inherit"
    );
    if (day == this.grid.day && hour == this.grid.hour) {
      console.log(
        `%carchive.list()%c same day and hour, do nothing`,
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
      symbol: this.data.symbol,
    });
    this.onupdate(this.tic++);
  }

  load(arg) {
    this.state.busyLoading = true;
    if (Number.isInteger(arg)) {
      this.loadByIndex(arg);
    } else {
      this.loadByName(arg);
    }
  }

  loadByIndex(index = -1) {
    if (index < 0 || index > this.grid.fileList.length - 1) {
      console.log(`archive.load() index = ${index} is out of range.`);
      return;
    }
    this.grid.index = index;
    this.loadByName(this.grid.fileList[index]);
  }

  loadByName(name = "PX-20130520-195944-E2.6-Z.nc") {
    this.message = `Loading ${name} ...`;
    this.state.loadCountSinceList++;
    this.worker.postMessage({ task: "load", name: name });
    this.onupdate(this.tic++);
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
    this.data.symbol = symbol;
    this.state.resetLoadCount = false;
    this.list(this.radar, this.grid.dateTimeString);
  }

  disableLiveUpdate() {
    this.worker.postMessage({ task: "disconnect" });
  }

  toggleLiveUpdate() {
    this.worker.postMessage({ task: "toggle" });
  }
}

export { Archive };

//
//  archive.worker.js
//  RadarHub
//
//  A separate web worker to load and parse arhived data in the background
//
//  Created by Boonleng Cheong
//

import { Parser } from "binary-parser";
import { deg2rad, clamp } from "./common";
// import { logger } from "./logger";

let source = null;
let radar;
let grid = {
  dateTimeString: "20130520-1900",
  daysActive: {},
  hoursActive: new Array(24).fill(0),
  yearsActive: new Array(200).fill(0),
  latestScan: "",
  latestHour: -1,
  items: [],
  itemsGrouped: {},
  day: new Date("2013/05/20"),
  hour: -1,
  symbol: "Z",
  index: -1,
  scan: "",
};
let data = {
  sweep: null,
};
let state = {
  verbose: 0,
};
const namecolor = "#bf9140";

const sweepParser = new Parser()
  .endianess("little")
  .uint16("nb")
  .uint16("nr")
  .uint16("nx")
  .uint16("reserved")
  .doublele("time")
  .doublele("longitude")
  .doublele("latitude")
  .doublele("doubleReserved")
  .floatle("scanElevation")
  .floatle("scanAzimuth")
  .floatle("rangeStart")
  .floatle("rangeSpacing")
  .string("info", { length: "nx" })
  .array("elevations", { type: "floatle", length: "nb" })
  .array("azimuths", { type: "floatle", length: "nb" })
  .array("values", {
    type: "uint8",
    length: function () {
      return this.nb * this.nr;
    },
  });

self.onmessage = ({ data: { task, name, day, hour, symbol } }) => {
  if (task == "init") {
    init();
  } else if (task == "load") {
    load(name);
  } else if (task == "list") {
    list(name, day, hour, symbol);
  } else if (task == "count") {
    count(name, day);
  } else if (task == "month") {
    month(name, day);
  } else if (task == "connect") {
    connect(name);
  } else if (task == "disconnect") {
    disconnect();
  } else if (task == "catchup") {
    catchup(name);
  } else if (task == "forward") {
    navigateForward();
  } else if (task == "backward") {
    navigateBackward();
  } else if (task == "forward-scan") {
    navigateForwardScan();
  } else if (task == "backward-scan") {
    navigateBackwardScan();
  } else if (task == "dummy") {
    dummy();
  } else {
    return;
  }
};

function init() {
  if (state.verbose) {
    console.info(`%carchive.worker.init()`, `color: ${namecolor}`, "");
  }
  self.postMessage({ type: "init", payload: grid });
}

function connect(newRadar) {
  radar = newRadar;
  if (source?.readyState == 1) {
    console.info("Closing existing connection ...");
    source.close();
  }
  if (state.verbose) console.info(`Connecting live update to ${radar} ...`);
  source = new EventSource("/events/");
  source.addEventListener(radar, (event) => {
    const payload = JSON.parse(event.data);
    payload.items.forEach((item) => {
      updateListWithItem(item);
    });
    grid.hoursActive = payload.hoursActive;
    grid.latestHour =
      23 -
      grid.hoursActive
        .slice()
        .reverse()
        .findIndex((x) => x > 0);
    self.postMessage({
      type: "list",
      payload: grid,
    });
  });
  self.postMessage({
    type: "state",
    payload: {
      state: "connect",
      message: `Listening for ${radar} ...`,
    },
  });
}

function disconnect() {
  if (source === null || source.readyState == 2) {
    return;
  }
  if (state.verbose) console.info("Disconnecting live update ...");
  source.close();
  self.postMessage({
    type: "state",
    payload: {
      state: "disconnect",
      message: "Live update disabled",
    },
  });
}

function updateListWithItem(item) {
  const elements = item.split("-");
  const symbol = elements[4].split(".")[0];
  if (symbol != grid.symbol) {
    return;
  }
  const scan = elements[3];
  const s = elements[1];
  const day = s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8);
  if (state.verbose) {
    console.info(
      `%carchive.worker.updateListWithFile()%c ${item} ${day}`,
      `color: ${namecolor}`,
      ""
    );
  }
  const listHour = elements[2].slice(0, 2);
  const dateTimeString = `${elements[1]}-${listHour}00`;
  if (grid.dateTimeString != dateTimeString) {
    grid.items = [];
    grid.itemsGrouped = {};
    grid.dateTimeString = dateTimeString;
    grid.hour = parseInt(listHour);
    grid.day = new Date(day);
    if (state.verbose) {
      console.info(
        `%carchive.worker.updateListWithFile()%c   ${day} ${grid.hour}`,
        `color: ${namecolor}`,
        ""
      );
    }
  }
  if (!(scan in grid.itemsGrouped)) {
    grid.itemsGrouped[scan] = [];
  }
  if (grid.items.indexOf(item) > 0) {
    console.warn(`Item ${item} exists.`);
    return;
  }
  const index = grid.items.length;
  grid.items.push(item);
  grid.itemsGrouped[scan].push({ item: item, index: index });
  // let targetScan = "E4.0";
  if (grid.scan[0] == "A") {
    console.log("RHI mode, always choose the latest.");
    grid.index = index;
  } else {
    if (grid.scan in grid.itemsGrouped) {
      grid.index = grid.itemsGrouped[grid.scan].slice(-1)[0].index;
    } else {
      grid.index = -1;
    }
  }
}

function createSweep(name = "dummy") {
  // Pad an extra azimuth and elevation
  return {
    name,
    nb: 4,
    nr: 3,
    nx: 0,
    time: 42,
    timeString: "1970/01/01 00:00:42 UTC",
    symbol: "U",
    isRHI: false,
    scanElevation: 4.0,
    scanAzimuth: 0.0,
    rangeStart: 1.0,
    rangeSpacing: 10.0,
    elevations: [4.0, 4.0, 4.0, 4.0, 4.0],
    azimuths: [0.0, 15.0, 30.0, 45.0, 60.0],
    values: [32, 77, 30, 10, 20, 15, 50, 60, 50, 80, 90, 100],
  };
}

function month(radar, day) {
  console.info(
    `%carchive.worker.month()%c ${radar} ${day}`,
    `color: ${namecolor}`,
    ""
  );
  const url = `/data/month/${radar}/${day}/`;
  fetch(url)
    .then((response) => {
      if (response.status == 200)
        response.json().then((buffer) => {
          grid.daysActive = buffer;
          self.postMessage({ type: "month", payload: buffer });
        });
      else
        response.text().then((error) => {
          self.postMessage({ type: "message", payload: error });
        });
    })
    .catch((error) => {
      console.error(`Unexpected error ${error}`);
    });
}

function count(radar, day) {
  let t = day instanceof Date ? "Date" : "Not Date";
  let dayString = day.toISOString().slice(0, 10).replace(/-/g, "");
  console.info(
    `%carchive.worker.count()%c ${radar} ${dayString} (${t})`,
    `color: ${namecolor}`,
    ""
  );
  let y = parseInt(dayString.slice(0, 4));
  if (y < 2012) {
    console.info("No data prior to 2013");
    return;
  }
  const url = `/data/count/${radar}/${dayString}/`;
  fetch(url)
    .then((response) => {
      if (response.status == 200)
        response.json().then((buffer) => {
          console.log(buffer);
          grid.day = day;
          grid.hoursActive = buffer.hoursActive;
          grid.latestHour =
            23 -
            grid.hoursActive
              .slice()
              .reverse()
              .findIndex((x) => x > 0);
          self.postMessage({
            type: "count",
            payload: {
              day: day,
              hoursActive: grid.hoursActive,
            },
          });
        });
      else
        response.text().then((error) => {
          self.postMessage({ type: "message", payload: error });
        });
    })
    .catch((error) => {
      console.error(`Unexpected error ${error}`);
    });
}

function list(radar, day, hour, symbol) {
  let dayString = day.toISOString().slice(0, 10).replace(/-/g, "");
  let hourString = clamp(hour, 0, 23).toString().padStart(2, "0");
  let dateTimeString = `${dayString}-${hourString}00`;
  console.info(
    `%carchive.worker.list()%c ${radar} ${dateTimeString} ${symbol}`,
    `color: ${namecolor}`,
    ""
  );
  if (dateTimeString == grid.dateTimeString) {
    let currentItems = grid.items;
    grid.items = [];
    grid.itemsGrouped = {};
    currentItems.forEach((item, index) => {
      let elements = item.split("-");
      elements[4] = symbol;
      item = elements.join("-");
      grid.items.push(item);
      let scanType = elements[3];
      if (!(scanType in grid.itemsGrouped)) {
        grid.itemsGrouped[scanType] = [];
      }
      grid.itemsGrouped[scanType].push({ item: item, index: index });
    });
    grid.symbol = symbol;
    self.postMessage({
      type: "list",
      payload: grid,
    });
    return;
  }
  const url = `/data/list/${radar}/${dateTimeString}-${symbol}/`;
  fetch(url)
    .then((response) => {
      if (response.status == 200)
        response.json().then((buffer) => {
          // console.log(buffer);
          grid.dateTimeString = dateTimeString;
          grid.day = day;
          grid.hour = buffer.hour;
          grid.symbol = symbol;
          grid.hoursActive = buffer.hoursActive;
          grid.latestHour =
            23 -
            grid.hoursActive
              .slice()
              .reverse()
              .findIndex((x) => x > 0);
          grid.items = buffer.items;
          grid.itemsGrouped = {};
          grid.items.forEach((item, index) => {
            let elements = item.split("-");
            let scanType = elements[3];
            if (!(scanType in grid.itemsGrouped)) {
              grid.itemsGrouped[scanType] = [];
            }
            grid.itemsGrouped[scanType].push({ item: item, index: index });
          });
          if (grid.scan in grid.itemsGrouped) {
            grid.index = grid.itemsGrouped[grid.scan].slice(-1)[0].index;
          } else {
            grid.index = grid.items.length ? grid.items.length - 1 : -1;
          }
          self.postMessage({
            type: "list",
            payload: grid,
          });
          if (grid.hour < 0) {
            self.postMessage({ type: "message", payload: "No Data" });
          }
        });
      else
        response.text().then((response) => {
          self.postMessage({ type: "message", payload: response });
        });
    })
    .catch((error) => {
      console.error(`Unexpected error ${error}`);
    });
}

function load(name) {
  const url = `/data/load/${name}/`;
  if (state.verbose) {
    console.info(
      `%carchive.worker.load() %c${url}`,
      `color: ${namecolor}`,
      "color: dodgerblue"
    );
  }
  grid.index = grid.items.indexOf(name);
  fetch(url, { cache: "force-cache" })
    .then((response) => {
      if (response.status == 200) {
        response.arrayBuffer().then((buffer) => {
          let sweep = geometry({
            ...createSweep(name),
            ...sweepParser.parse(new Uint8Array(buffer)),
          });
          let components = sweep.name.split("-");
          sweep.timeString =
            `${components[1].slice(0, 4)}/` +
            `${components[1].slice(4, 6)}/` +
            `${components[1].slice(6, 8)} ` +
            `${components[2].slice(0, 2)}:` +
            `${components[2].slice(2, 4)}:` +
            `${components[2].slice(4, 6)} UTC`;
          sweep.symbol = components[4].split(".")[0];
          sweep.info = JSON.parse(sweep.info);
          sweep.infoString =
            `Gatewidth: ${sweep.info.gatewidth} m\n` +
            `Waveform: ${sweep.info.waveform}`;
          // console.log(
          //   `timeString = ${sweep.timeString}   symbol = ${sweep.symbol}`
          // );
          let scan = components[3];
          if (state.verbose > 1) {
            console.debug(
              `%carchive.worker.load() %cgrid.scan ${grid.scan} -> ${scan}`,
              `color: ${namecolor}`,
              "color: dodgerblue"
            );
          }
          grid.scan = scan;
          if (sweep.nb == 0 || sweep.nr == 0) {
            console.log(sweep);
            self.postMessage({
              type: "message",
              payload: `Failed to load ${name}`,
            });
            return;
          }
          self.postMessage({ type: "load", payload: sweep });
        });
      } else {
        response.text().then((text) => {
          console.info(text);
          self.postMessage({ type: "reset", payload: text });
        });
      }
    })
    .catch((error) => {
      console.error(`Unexpected error ${error}`);
    });
}

function dummy() {
  let sweep = createSweep();
  sweep = geometry(sweep);
  self.postMessage({ type: "load", payload: sweep });
}

function geometry(sweep) {
  let scan = sweep["name"].split("-")[3];
  const rs = sweep.rangeStart;
  const re = sweep.rangeStart + sweep.nr * sweep.rangeSpacing;
  let el_pad = 0.0;
  let az_pad = 0.0;
  const ii = clamp(sweep.nb / 2, 0, sweep.nb - 1);
  if (scan[0] == "E") {
    sweep.isRHI = false;
    const da = sweep.azimuths[ii] - sweep.azimuths[ii - 1];
    el_pad = sweep.elevations[sweep.nb - 1];
    az_pad = sweep.azimuths[sweep.nb - 1] + da;
  } else if (scan[0] == "A") {
    sweep.isRHI = true;
    const de = sweep.elevations[ii] - sweep.elevations[ii - 1];
    el_pad = sweep.elevations[sweep.nb - 1] + de;
    az_pad = sweep.azimuths[sweep.nb - 1];
  } else {
    const da = sweep.azimuths[ii] - sweep.azimuths[ii - 1];
    const de = sweep.elevations[ii] - sweep.elevations[ii - 1];
    el_pad = sweep.elevations[sweep.nb - 1] + de;
    az_pad = sweep.azimuths[sweep.nb - 1] + da;
  }
  sweep.elevations.push(el_pad);
  sweep.azimuths.push(az_pad);
  let points = [];
  let origins = [];
  let elements = [];
  for (let k = 0; k < sweep.nb + 1; k++) {
    const e = deg2rad(sweep.elevations[k]);
    const a = deg2rad(sweep.azimuths[k]);
    const ce = Math.cos(e);
    const se = Math.sin(e);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const v = k / sweep.nb;
    const x = ce * sa;
    const y = ce * ca;
    points.push(rs * x, rs * y, rs * se);
    points.push(re * x, re * y, re * se);
    origins.push(0, v);
    origins.push(1, v);
  }
  for (let o = 2, l = 2 * sweep.nb; o <= l; o += 2) {
    elements.push(o - 2, o - 1, o);
    elements.push(o - 1, o, o + 1);
  }
  sweep.points = points;
  sweep.origins = origins;
  sweep.elements = elements;
  return sweep;
}

function catchup(radar) {
  console.info(
    `%carchive.worker.catchup()%c ${radar}`,
    `color: ${namecolor}`,
    "color: dodgerblue"
  );
  fetch(`/data/catchup/${radar}/`).then((response) => {
    if (response.status == 200) {
      response
        .json()
        .then((buffer) => {
          let day = new Date(buffer.dayISOString);
          if (state.verbose) {
            console.info(
              `%carchive.worker.catchup()%c` +
                `   dateTimeString = ${buffer.dateTimeString}` +
                `   hour = ${buffer.hour}  `,
              `color: ${namecolor}`,
              ""
            );
          }
          grid.dateTimeString = buffer.dateTimeString;
          grid.hoursActive = buffer.hoursActive;
          grid.latestScan = buffer.latestScan;
          grid.latestHour = buffer.hour;
          grid.day = day;
          grid.hour = buffer.hour;
          grid.items = buffer.items;
          grid.itemsGrouped = {};
          grid.items.forEach((item, index) => {
            let elements = item.split("-");
            let scanType = elements[3];
            if (!(scanType in grid.itemsGrouped)) {
              grid.itemsGrouped[scanType] = [];
            }
            grid.itemsGrouped[scanType].push({ item: item, index: index });
          });
          grid.yearsActive.splice(
            100,
            buffer.yearsActive.length,
            ...buffer.yearsActive
          );
          if (state.verbose > 1) {
            console.info(grid.items);
            console.info(grid.itemsGrouped);
            console.info(`grid.scan = ${grid.scan}`);
            console.info(`grid.index = ${grid.index}`);
          }
          if (grid.scan[0] == "A") {
            grid.index = grid.items.length - 1;
          } else if (grid.scan in grid.itemsGrouped) {
            grid.index = grid.itemsGrouped[grid.scan].slice(-1)[0].index;
          } else {
            grid.index = grid.items.length ? grid.items.length - 1 : -1;
          }
          if (grid.index >= 0) {
            let file = grid.items[grid.index];
            grid.scan = file.split("-")[3];
            console.debug(`Setting grid.scan to ${grid.scan}`);
          }
          self.postMessage({
            type: "list",
            payload: grid,
          });
          return radar;
        })
        .then((radar) => connect(radar))
        .catch((error) => console.error(`Unexpected error ${error}`));
    } else {
      console.error("Unable to catch up.");
    }
  });
}

function updateGridIndex(index) {
  if (state.verbose > 1) {
    console.info(
      `%carchive.worker.updateGridIndex()%c ${grid.index} -> ${index}`,
      `color: ${namecolor}`,
      "color: dodgerblue"
    );
  }
  if (index == grid.index) {
    if (state.verbose > 1) {
      console.debug(
        `index = ${index} == grid.index = ${grid.index}. Do nothing.`
      );
    }
    return;
  }
  grid.index = index;
  self.postMessage({ type: "index", payload: index });
}

function navigateForward() {
  let index = clamp(grid.index + 1, 0, grid.items.length - 1);
  updateGridIndex(index);
}

function navigateBackward() {
  let index = clamp(grid.index - 1, 0, grid.items.length - 1);
  updateGridIndex(index);
}

function updateGridIndexByScan(delta) {
  if (grid.itemsGrouped.length == 0) return;
  let k = -1;
  let ii = [];
  grid.itemsGrouped[grid.scan].forEach(({ file, index }) => {
    ii.push(index);
    if (index == grid.index) {
      k = ii.length - 1;
    }
  });
  let index = ii[clamp(k + delta, 0, ii.length - 1)];
  updateGridIndex(index);
}

function navigateForwardScan() {
  updateGridIndexByScan(1);
}

function navigateBackwardScan() {
  updateGridIndexByScan(-1);
}

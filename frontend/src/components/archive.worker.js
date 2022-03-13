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

let source = null;
let radar;
let grid = {
  hourlyAvailability: new Array(24).fill(0),
  dateTimeString: "20130520-1900",
  fileListGrouped: {},
  fileList: [],
  symbol: "Z",
  index: -1,
  hour: -1,
  day: -1,
};
let data = {
  sweep: null,
};

const sweepParser = new Parser()
  .endianess("little")
  .uint16("na")
  .uint16("nr")
  .uint16("reserved1")
  .uint16("reserved2")
  .doublele("time")
  .doublele("longitude")
  .doublele("latitude")
  .doublele("reserved3")
  .floatle("scanElevation")
  .floatle("scanAzimuth")
  .floatle("rangeStart")
  .floatle("rangeSpacing")
  .array("elevations", { type: "floatle", length: "na" })
  .array("azimuths", { type: "floatle", length: "na" })
  .array("values", {
    type: "uint8",
    length: function () {
      return this.na * this.nr;
    },
  });

self.onmessage = ({ data: { task, name, day, hour, symbol } }) => {
  if (task == "load") {
    load(name);
  } else if (task == "list") {
    list(name, day, hour, symbol);
  } else if (task == "count") {
    count(name, day);
  } else if (task == "month") {
    month(name, day);
  } else if (task == "dummy") {
    dummy();
  } else if (task == "connect") {
    connect(name);
  } else if (task == "disconnect") {
    disconnect();
  } else if (task == "toggle") {
    console.log(`source.readyState = ${source.readyState}`);
    if (source.readyState == 2) {
      connect(radar);
    } else {
      disconnect();
    }
  }
};

function connect(newRadar) {
  radar = newRadar;

  source = new EventSource("/events/");

  source.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    payload.files.forEach((file) => {
      // console.log(
      //   `%csource.onmessage()%c ${file}`,
      //   "color: lightseagreen",
      //   "color: inherit"
      // );
      updateListWithFile(file);
    });
    grid.hourlyAvailability = payload.count;
    self.postMessage({
      type: "list",
      payload: grid,
    });
  };

  self.postMessage({
    type: "message",
    payload: `Listening for ${radar} ...`,
  });
}

function disconnect() {
  if (source.readyState == 2) {
    return;
  }
  console.log("Disconnecting live update ...");
  source.close();
  self.postMessage({
    type: "message",
    payload: `Live update disabled`,
  });
}

function updateListWithFile(file) {
  const elements = file.split("-");
  const symbol = elements[4].split(".")[0];
  if (symbol != grid.symbol) {
    return;
  }
  const scan = elements[3];
  const s = elements[1];
  const day = s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8);
  // console.log(`updateListWithFile() ${file} ${day}`);
  const listHour = elements[2].slice(0, 2);
  const dateTimeString = `${elements[1]}-${listHour}00`;
  if (grid.dateTimeString != dateTimeString) {
    grid.fileList = [];
    grid.fileListGrouped = {};
    grid.dateTimeString = dateTimeString;
    grid.hour = parseInt(listHour);
    grid.day = Date(day);
    console.log(
      `%carchive.worker.updateListWithFile()%c   ${day} ${grid.hour}`,
      "color: lightseagreen",
      "color: inherit"
    );
  }
  if (!(scan in grid.fileListGrouped)) {
    grid.fileListGrouped[scan] = [];
  }
  const index = grid.fileList.length;
  grid.fileList.push(file);
  grid.fileListGrouped[scan].push({ file: file, index: index });
  let targetScan = "E4.0";
  if (targetScan in grid.fileListGrouped) {
    grid.index = grid.fileListGrouped[targetScan].slice(-1)[0].index;
  } else {
    // data.index = data.fileList.length ? data.fileList.length - 1 : -1;
    grid.index = -1;
  }
}

function createSweep(name = "dummy") {
  // Pad an extra azimuth and elevation
  return {
    name,
    na: 4,
    nr: 3,
    time: 9,
    timeString: "1970/01/01 00:00:00 UTC",
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
  console.log(
    `%carchive.worker.month()%c ${radar} ${day}`,
    "color: lightseagreen",
    "color: inherit"
  );
  const url = `/data/month/${radar}/${day}/`;
  fetch(url)
    .then((response) => {
      if (response.status == 200)
        response.json().then((buffer) => {
          grid.dailyAvailability = buffer;
          self.postMessage({ type: "month", payload: buffer });
        });
      else
        response.text().then((error) => {
          self.postMessage({ type: "message", payload: error });
        });
    })
    .catch((error) => {
      console.log(`Unexpected error ${error}`);
    });
}

function count(radar, day) {
  console.log(
    `%carchive.worker.count()%c ${radar} ${day}`,
    "color: lightseagreen",
    "color: inherit"
  );
  let tmp = day.toISOString();
  let y = parseInt(tmp.slice(0, 4));
  if (y < 2012) {
    console.log("No data prior to 2013");
    return;
  }
  let dayString = tmp.slice(0, 10).replace(/-/g, "");
  const url = `/data/count/${radar}/${dayString}/`;
  fetch(url)
    .then((response) => {
      if (response.status == 200)
        response.json().then((buffer) => {
          grid.day = day;
          grid.hourlyAvailability = buffer.count;
          self.postMessage({ type: "count", payload: grid.hourlyAvailability });
        });
      else
        response.text().then((error) => {
          self.postMessage({ type: "message", payload: error });
        });
    })
    .catch((error) => {
      console.log(`Unexpected error ${error}`);
    });
}

function list(radar, day, hour, symbol) {
  console.log(
    `%carchive.worker.list()%c ${radar} ${day.toISOString()} ${hour} ${symbol}`,
    "color: lightseagreen",
    "color: inherit"
  );
  let dayString = day.toISOString().slice(0, 10).replace(/-/g, "");
  let hourString = hour.toString().padStart(2, "0");
  let dateTimeString = `${dayString}-${hourString}00`;
  const url = `/data/list/${radar}/${dateTimeString}-${symbol}/`;
  fetch(url)
    .then((response) => {
      if (response.status == 200)
        response.json().then((buffer) => {
          grid.dateTimeString = dateTimeString;
          grid.day = day;
          grid.hour = hour;
          grid.symbol = symbol;
          grid.fileList = buffer.list;
          grid.fileListGrouped = {};
          grid.fileList.forEach((file, index) => {
            let elements = file.split("-");
            let scanType = elements[3];
            if (!(scanType in grid.fileListGrouped)) {
              grid.fileListGrouped[scanType] = [];
            }
            grid.fileListGrouped[scanType].push({ file: file, index: index });
          });
          console.log(grid.fileListGrouped);
          let scanType = "E4.0";
          if (scanType in grid.fileListGrouped) {
            grid.index = grid.fileListGrouped[scanType].slice(-1)[0].index;
          } else {
            grid.index = grid.fileList.length ? grid.fileList.length - 1 : -1;
          }
          self.postMessage({
            type: "list",
            payload: grid,
          });
        });
      else
        response.text().then((response) => {
          self.postMessage({ type: "message", payload: response });
        });
    })
    .catch((error) => {
      console.log(`Unexpected error ${error}`);
    });
}

function load(name) {
  const url = `/data/load/${name}/`;
  console.log(
    `%carchiver.worker.load()%c ${url}`,
    "color: lightseagreen",
    "color: inherit"
  );
  fetch(url)
    .then((response) => {
      if (response.status == 200)
        response.arrayBuffer().then((buffer) => {
          let sweep = geometry({
            ...createSweep(name),
            ...sweepParser.parse(new Uint8Array(buffer)),
          });
          // console.log(sweep);
          let components = sweep.name.split("-");
          sweep.timeString =
            `${components[1].slice(0, 4)}/` +
            `${components[1].slice(4, 6)}/` +
            `${components[1].slice(6, 8)} ` +
            `${components[2].slice(0, 2)}:` +
            `${components[2].slice(2, 4)}:` +
            `${components[2].slice(4, 6)} UTC`;
          sweep.symbol = components[4].split(".")[0];
          //console.log(`timeString = ${sweep.timeString}   symbol = ${sweep.symbol}`)

          self.postMessage({ type: "load", payload: sweep });
        });
      else {
        response.text().then((text) => {
          console.log(text);
          self.postMessage({ type: "reset", payload: text });
        });
      }
    })
    .catch((error) => {
      console.log(`Unexpected error ${error}`);
    });
}

function dummy() {
  let sweep = createSweep();
  sweep = geometry(sweep);
  self.postMessage({ type: "load", payload: sweep });
}

function geometry(sweep) {
  let points = [];
  let origins = [];
  let elements = [];
  const e = deg2rad(sweep.scanElevation);
  const rs = sweep.rangeStart;
  const re = sweep.rangeStart + sweep.nr * sweep.rangeSpacing;
  const ce = Math.cos(e);
  const z = Math.sin(e);
  const m = clamp(sweep.na / 2, 0, sweep.na - 1);
  const da = sweep.azimuths[m] - sweep.azimuths[m - 1];
  let az = sweep.azimuths[sweep.na - 1] + da;
  sweep.azimuths.push(az);
  for (let k = 0; k < sweep.azimuths.length; k++) {
    const a = deg2rad(sweep.azimuths[k]);
    const v = k / sweep.na;
    const x = ce * Math.sin(a);
    const y = ce * Math.cos(a);
    points.push(rs * x, rs * y, rs * z);
    points.push(re * x, re * y, re * z);
    origins.push(0, v);
    origins.push(1, v);
  }
  for (let o = 2, l = 2 * sweep.na; o <= l; o += 2) {
    elements.push(o - 2, o - 1, o);
    elements.push(o - 1, o, o + 1);
  }
  sweep.points = points;
  sweep.origins = origins;
  sweep.elements = elements;
  return sweep;
}

// fetch("/data/binary/PX-20200520-060102")
//   .then((resp) => resp.arrayBuffer())
//   .then((data) => {
//     var elev = new Float32Array(data.slice(0, 4));
//     var bytes = new Uint8Array(data.slice(4));
//     console.log(`elev = ${elev}`);
//     console.log(bytes);
//   });

// fetch("/data/header/PX-20130520-191140-E2.6-Z.nc/")
//   .then((resp) => resp.json())
//   .then((data) => {
//     console.log(data);
//   });

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
  dateTimeString: "20130520-1900",
  dailyAvailability: {},
  hourlyAvailability: new Array(24).fill(0),
  latestHour: -1,
  latestFile: "",
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
  .uint16("nb")
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
  .array("elevations", { type: "floatle", length: "nb" })
  .array("azimuths", { type: "floatle", length: "nb" })
  .array("values", {
    type: "uint8",
    length: function () {
      return this.nb * this.nr;
    },
  });

self.onmessage = ({ data: { task, name, day, hour, symbol } }) => {
  if (task == "dummy") {
    dummy();
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
  }
};

function connect(newRadar) {
  radar = newRadar;
  if (source?.readyState == 1) {
    console.log("Connection exists");
    source.close();
  }
  console.log(`Connecting live update to ${radar} ...`);
  source = new EventSource("/events/");
  source.addEventListener(radar, (event) => {
    const payload = JSON.parse(event.data);
    payload.files.forEach((file) => {
      // console.log(
      //   `%csource.onmessage()%c ${file}`,
      //   "color: tan",
      //   "color: #aa6611"
      // );
      updateListWithFile(file);
    });
    grid.hourlyAvailability = payload.count;
    grid.latestHour =
      23 -
      payload.count
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
  console.log("Disconnecting live update ...");
  source.close();
  self.postMessage({
    type: "state",
    payload: {
      state: "disconnect",
      message: "Live update disabled",
    },
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
  console.log(
    `%carchive.worker.updateListWithFile()%c ${file} ${day}`,
    "color: tan",
    "color: inherit"
  );
  const listHour = elements[2].slice(0, 2);
  const dateTimeString = `${elements[1]}-${listHour}00`;
  if (grid.dateTimeString != dateTimeString) {
    grid.fileList = [];
    grid.fileListGrouped = {};
    grid.dateTimeString = dateTimeString;
    grid.hour = parseInt(listHour);
    grid.day = new Date(day);
    console.log(
      `%carchive.worker.updateListWithFile()%c   ${day} ${grid.hour}`,
      "color: tan",
      "color: inherit"
    );
  }
  if (!(scan in grid.fileListGrouped)) {
    grid.fileListGrouped[scan] = [];
  }
  if (grid.fileList.indexOf(file) > 0) {
    console.log(`File ${file} exists.`);
    return;
  }
  const index = grid.fileList.length;
  grid.fileList.push(file);
  grid.fileListGrouped[scan].push({ file: file, index: index });
  let targetScan = "E4.0";
  if (targetScan in grid.fileListGrouped) {
    grid.index = grid.fileListGrouped[targetScan].slice(-1)[0].index;
  } else {
    grid.index = -1;
  }
}

function createSweep(name = "dummy") {
  // Pad an extra azimuth and elevation
  return {
    name,
    nb: 4,
    nr: 3,
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
  console.log(
    `%carchive.worker.month()%c ${radar} ${day}`,
    "color: tan",
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
  let t = day instanceof Date ? "Date" : "Not Date";
  let dayString = day.toISOString().slice(0, 10).replace(/-/g, "");
  console.log(
    `%carchive.worker.count()%c ${radar} ${dayString} (${t})`,
    "color: tan",
    "color: inherit"
  );
  let y = parseInt(dayString.slice(0, 4));
  if (y < 2012) {
    console.log("No data prior to 2013");
    return;
  }
  const url = `/data/count/${radar}/${dayString}/`;
  fetch(url)
    .then((response) => {
      if (response.status == 200)
        response.json().then((buffer) => {
          grid.day = day;
          grid.hourlyAvailability = buffer.count;
          grid.latestHour =
            23 -
            buffer.count
              .slice()
              .reverse()
              .findIndex((x) => x > 0);
          self.postMessage({
            type: "count",
            payload: {
              day: day,
              hourlyAvailability: grid.hourlyAvailability,
            },
          });
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
  let dayString = day.toISOString().slice(0, 10).replace(/-/g, "");
  let hourString = hour.toString().padStart(2, "0");
  let dateTimeString = `${dayString}-${hourString}00`;
  console.log(
    `%carchive.worker.list()%c ${radar} ${dateTimeString} ${symbol}`,
    "color: tan",
    "color: inherit"
  );
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
          grid.hourlyAvailability = buffer.count;
          grid.latestHour = buffer.last;
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
    `%carchiver.worker.load() %c${url}`,
    "color: tan",
    "color: dodgerblue"
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
          // console.log(
          //   `timeString = ${sweep.timeString}   symbol = ${sweep.symbol}`
          // );
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
  let scan = sweep["name"].split("-")[3];
  let points = [];
  let origins = [];
  let elements = [];
  const rs = sweep.rangeStart;
  const re = sweep.rangeStart + sweep.nr * sweep.rangeSpacing;
  if (scan[0] == "E") {
    sweep.isRHI = false;
    const e = deg2rad(sweep.scanElevation);
    const ce = Math.cos(e);
    const se = Math.sin(e);
    const ii = clamp(sweep.nb / 2, 0, sweep.nb - 1);
    const da = sweep.azimuths[ii] - sweep.azimuths[ii - 1];
    const az = sweep.azimuths[sweep.nb - 1] + da;
    sweep.azimuths.push(az);
    for (let k = 0; k < sweep.nb + 1; k++) {
      const a = deg2rad(sweep.azimuths[k]);
      const v = k / sweep.nb;
      const x = ce * Math.sin(a);
      const y = ce * Math.cos(a);
      points.push(rs * x, rs * y, rs * se);
      points.push(re * x, re * y, re * se);
      origins.push(0, v);
      origins.push(1, v);
    }
    for (let o = 2, l = 2 * sweep.nb; o <= l; o += 2) {
      elements.push(o - 2, o - 1, o);
      elements.push(o - 1, o, o + 1);
    }
  } else if (scan[0] == "A") {
    sweep.isRHI = true;
    const a = deg2rad(sweep.scanAzimuth);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const ii = sweep.nb - 1;
    const de = sweep.elevations[ii] - sweep.elevations[ii - 1];
    const el = sweep.elevations[sweep.nb - 1] + de;
    sweep.elevations.push(el);
    for (let k = 0; k < sweep.nb + 1; k++) {
      const e = deg2rad(sweep.elevations[k]);
      const ce = Math.cos(e);
      const se = Math.sin(e);
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
  }
  sweep.points = points;
  sweep.origins = origins;
  sweep.elements = elements;
  return sweep;
}

function catchup(radar) {
  console.log(
    `%carchive.worker.catchup()%c radar = ${radar}`,
    "color: tan",
    "color: inherit"
  );
  fetch(`/data/catchup/${radar}/`).then((response) => {
    if (response.status == 200) {
      response
        .json()
        .then((buffer) => {
          let day = new Date(buffer.dayISOString);
          console.log(
            `%carchive.worker.catchup()%c dateString = ${buffer.dateString}` +
              `   hour = ${buffer.hour}  `,
            "color: tan",
            "color: inherit"
          );
          grid.dateTimeString = buffer.dateString;
          grid.hourlyAvailability = buffer.count;
          grid.latestHour = buffer.hour;
          grid.latestFile = buffer.file;
          grid.fileList = buffer.list;
          grid.hour = buffer.hour;
          grid.day = day;
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
          return radar;
        })
        .then((radar) => connect(radar))
        .catch((error) => console.log(`Unexpected error ${error}`));
    } else {
      console.log("Unable to catch up.");
    }
  });
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

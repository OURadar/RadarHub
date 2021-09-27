//
//  archive.worker.js
//  RadarHub
//
//  A separate web worker to load and parse arhived data in the background
//
//  Created by Boonleng Cheong
//

import { Parser } from "binary-parser";

const sweepParser = new Parser()
  .endianess("little")
  .uint16("na")
  .uint16("nr")
  .array("azimuth", { type: "floatle", length: "na" })
  .array("values", {
    type: "uint8",
    length: function () {
      return this.na * this.nr;
    },
  });

self.onmessage = ({ data: { task, name, day, time } }) => {
  if (task == "load") {
    load(name);
  } else if (task == "list") {
    list(time);
  } else if (task == "count") {
    count(day);
  }
};

function count(day) {
  console.log(`%carchive.worker.count() ${day}`, "color: lightseagreen");
  const url = `/data/count/${day}/`;
  fetch(url)
    .then((response) => {
      if (response.status == 200)
        response.json().then((buffer) => {
          self.postMessage({ type: "count", payload: buffer.count });
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

function list(day) {
  console.log(`%carchive.worker.list() ${day}`, "color: lightseagreen");
  const url = `/data/list/${day}/`;
  fetch(url)
    .then((response) => {
      if (response.status == 200)
        response.json().then((buffer) => {
          self.postMessage({ type: "list", payload: buffer.list });
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
  const url = `/data/load/${name}`;
  console.log(`Background fetching ${url}`);
  fetch(url)
    .then((response) => {
      if (response.status == 200)
        response.arrayBuffer().then((buffer) => {
          let sweep = { name, ...sweepParser.parse(new Uint8Array(buffer)) };
          console.log(sweep);
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

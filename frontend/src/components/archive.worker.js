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

let data = {
  list: [],
  sweep: {
    el: [],
    az: [],
    values: [],
  },
};

self.onmessage = ({ data: { task, name, day } }) => {
  if (task == "load") {
    load(name);
  } else if (task == "list") {
    list(day);
  }
};

function list(day) {
  console.log(`%carchive.worker.list() ${day}`, "color: darkgreen");
  const url = `/data/list/${day}/`;
  fetch(url)
    .then((response) => {
      if (response.status == 200)
        response.json().then((buffer) => {
          data.list = buffer.list;
          self.postMessage({ type: "list", payload: data.list });
        });
      else
        response.text().then((error) => {
          console.log(error);
        });
    })
    .catch((error) => {
      console.log(`Unexpected error ${error}`);
    });
}

function load(name) {
  const url = `/data/file/${name}`;
  console.log(`Background fetching ${url}`);
  fetch(url)
    .then((response) => {
      if (response.status == 200)
        response.arrayBuffer().then((buffer) => {
          data.sweep = sweepParser.parse(new Uint8Array(buffer));
          self.postMessage({ type: "data", payload: data.sweep });
        });
      else
        response.text().then((error) => {
          console.log(error);
        });
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

//
//  archive.js
//  RadarHub
//
//  Created by Boonleng Cheong on 9/23/2021.
//

const Parser = require("binary-parser").Parser;

class Archive {
  constructor() {
    this.data = {
      sweep: {
        az: [],
        el: [],
        values: [],
      },
    };
    this.tic = 0;
    this.message = "";
    this.response = "";
    this.onupdate = (_data) => {};

    this.sweepParser = new Parser()
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

    this.worker = new Worker("/static/frontend/archive.js");
    this.worker.onmessage = ({ data: { type, payload } }) => {
      if (type == "file") {
        const name = payload;
        console.log(name);
      }
    };
  }

  load(name) {
    const url = `/data/file/${name}`;
    console.log(`Fetching ${url}`);

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

    fetch(url)
      .then((response) => {
        if (response.status == 200)
          response.arrayBuffer().then((data) => {
            const buff = new Uint8Array(data);
            this.onupdate(this.sweepParser.parse(buff));
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
}

export { Archive };

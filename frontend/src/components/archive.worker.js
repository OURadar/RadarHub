//
//  archive.worker.js
//  RadarHub
//
//  A separate web worker to load arhived data in the background
//
//  Created by Boonleng Cheong
//

let data = {
  sweep: {
    el: [],
    az: [],
    values: [],
  },
};

self.onmessage = ({ data: { task, payload } }) => {
  if (task == "file") {
    // fetch
    const name = payload;
    console.log(`Loading file ${name} ...`);
  }
};

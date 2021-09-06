//
//  overlay-worker.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

// import { Polygon } from "./polygon";
// import { Text } from "./text";

onmessage = (e) => {
  if (e.data.type == "init") {
    console.log(e.data.geometry);
    self.postMessage({
      reply: e.data.geometry,
    });
  }
};

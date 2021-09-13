//
//  earth-grid.js
//  RadarHub
//
//  Created by Boonleng Cheong on 8/25/2021.
//

import { earthRadius } from "./common";

let points = [];
let elements = [];
const latCount = 17;
const lonCount = 36;
var lat = (80.0 / 180.0) * Math.PI;
for (let j = 0; j < latCount; j++) {
  for (let k = 0; k < lonCount; k++) {
    const lon = (k * 2 * Math.PI) / lonCount;
    points.push([
      earthRadius * Math.cos(lat) * Math.sin(lon),
      earthRadius * Math.sin(lat),
      earthRadius * Math.cos(lat) * Math.cos(lon),
    ]);
  }
  lat -= Math.PI / 18;
}
for (let k = 0; k < latCount; k++) {
  elements.push(
    Array.from(Array(lonCount), (_, j) => [
      k * lonCount + j,
      k * lonCount + ((j + 1) % lonCount),
    ])
  );
}
for (let k = 0; k < lonCount; k++) {
  elements.push(
    Array.from(Array(latCount - 1), (_, j) => [
      k + j * lonCount,
      k + (j + 1) * lonCount,
    ])
  );
}

points = points.flat();
elements = elements.flat();

export { points, elements };

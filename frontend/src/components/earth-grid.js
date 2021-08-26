//
//  texture.js
//  RadarHub
//
//  Created by Boonleng Cheong on 8/25/2021.
//

let points = [];
let normals = [];
let elements = [];
const latCount = 17;
const lonCount = 36;
const r = 6357;
var lat = (80.0 / 180.0) * Math.PI;
for (let j = 0; j < latCount; j++) {
  for (let k = 0; k < lonCount; k++) {
    const lon = (k * 2 * Math.PI) / lonCount;
    const xyz = [
      Math.cos(lat) * Math.sin(lon),
      Math.sin(lat),
      Math.cos(lat) * Math.cos(lon),
    ];
    points.push([r * xyz[0], r * xyz[1], r * xyz[2]]);
    normals.push(xyz);
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
normals = normals.flat();
elements = elements.flat();

export { points, normals, elements };

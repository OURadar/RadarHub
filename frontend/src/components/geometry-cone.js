//
//  geometry-cone.js
//  RadarHub
//
//  Draw with basic3, "lines"
//
//  Created by Boonleng Cheong on 4/15/2022
//

let points = [];
const count = 10;
let theta;
let point;

for (let k = 0; k < count; k++) {
  points.push([0.0, 0.0, 1.0]);
  theta = (k * 2 * Math.PI) / count;
  point = [Math.cos(theta), Math.sin(theta), 0.0];
  points.push(point);
  points.push(point);
  theta = ((k + 1) * 2 * Math.PI) / count;
  point = [Math.cos(theta), Math.sin(theta), 0.0];
  points.push(point);
}

points = points.flat();

export { points };

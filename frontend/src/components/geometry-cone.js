//
//  geometry-cone.js
//  RadarHub
//
//  Draw with basic3, "lines"
//
//  Created by Boonleng Cheong on 4/15/2022
//

let points = [];
let count = 12;
let theta;
let point;

const offset = Math.PI / count;
for (let k = 0; k < count; k++) {
  points.push([0.0, 0.0, 1.0]);
  theta = (k * 2 * Math.PI) / count + offset;
  point = [Math.cos(theta), Math.sin(theta), 0.0];
  points.push(point);
  points.push(point);
  theta = ((k + 1) * 2 * Math.PI) / count + offset;
  point = [Math.cos(theta), Math.sin(theta), 0.0];
  points.push(point);
}

// X (right)
points.push([0.0, 0.0, 1.0]);
points.push([1.0, 0.0, 1.0]);

// Y (up)
points.push([0.0, 0.0, 1.0]);
points.push([0.0, 1.0, 1.0]);

count = count * 4 + 4;

export { points, count };

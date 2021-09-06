//
//  overlay.worker.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

let text;

onmessage = (e) => {
  if (e.data.type == "init") {
    text = e.data.text;
    self.postMessage({
      reply: "init",
    });
  } else if (e.data.type == "update") {
    if (text === undefined) return;
    const opacity = reviseOpacity(e.data.geometry);
    self.postMessage({
      type: "opacity",
      opacity: opacity,
    });
  }
};

/**
 * Determines if two retangles overlap
 *
 *                     1[2, 3]
 *      +---------------+
 *      |               |   2[2, 3]
 *      |      +--------+------+
 *      |      |        |      |
 *      +------+--------+      |
 *   1[0, 1]   |               |
 *             +---------------+
 *          2[0, 1]
 *
 * @param {Array4} rect1 the 1st rectangle
 * @param {Array4} rect2 the 2nd rectangle
 * @returns {boolean} out
 */
function doOverlap(rect1, rect2) {
  if (
    rect1[2] <= rect2[0] ||
    rect1[0] >= rect2[2] ||
    rect1[3] <= rect2[1] ||
    rect1[1] >= rect2[3]
  )
    return false;
  return true;
}

/**
 * Transforms the vec4 with a mat4.
 * Simplified version where w = 1.0 and z is not calculated
 *
 * @param {vec4} out the receiving vector
 * @param {ReadonlyVec3} a the vector to transform
 * @param {ReadonlyMat4} m matrix to transform with
 * @returns {vec4} out
 */
function transformMat4(out, a, m) {
  let x = a[0],
    y = a[1],
    z = a[2];
  out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
  out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
  out[2] = 0.0;
  out[3] = m[3] * x + m[7] * y + m[11] * z + m[15];
  return out;
}

/**
 * Convert an angle from radian to degree
 *
 * @param {x} x the input angle in radians
 * @returns angle in degrees
 */
function rad2deg(x) {
  return (x / Math.PI) * 180.0;
}

/**
 * Returns the angle between two vectors
 *
 * @param {*} a input vector 1
 * @param {*} b input vector 2
 * @returns angle between vector a and b
 */
function dotAngle(a, b) {
  const m = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  const n = Math.sqrt(b[0] * b[0] + b[1] * b[1] + b[2] * b[2]);
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.acos(dot / (m * n));
}

// Viewpoint is always 2R from the center of the sphere
// Maximum visible longitude = acos(R / 2R) = 1.047, no need to go extreme
function reviseOpacity(geometry) {
  let pass1 = 0;
  let pass2 = 0;
  let pass3 = 0;
  let indices = [];
  let rectangles = [];
  let visibility = new Array(text.points.length).fill(0);

  const t2 = new Date().getTime();

  const points = text.points;
  const extents = text.extents;
  const viewportWidth = geometry.viewport.width;
  const viewportHeight = geometry.viewport.height;
  const maxWeight = 4.5 + 0.5 / geometry.fov;
  for (let k = 0, l = text.points.length; k < l; k++) {
    if (dotAngle(geometry.satPosition, points[k]) > 0.9) {
      pass1++;
      continue;
    }

    if (text.weights[k] > maxWeight) {
      pass2++;
      continue;
    }

    visibility[k] = 1;
    const [w, h] = extents[k];
    const t = transformMat4([], points[k], geometry.viewprojection);
    const x = (t[0] / t[3]) * viewportWidth;
    const y = (t[1] / t[3]) * viewportHeight;
    const rect = [x - w, y - h, x + w, y + h];
    rectangles.push(rect);
    indices.push(k);
  }

  const t1 = new Date().getTime();

  indices.forEach((i, k) => {
    const rect = rectangles[k];
    for (let j = 0; j < k; j++) {
      const t = indices[j];
      if (visibility[t] && doOverlap(rect, rectangles[j])) {
        visibility[i] = 0;
        pass3++;
        return;
      }
    }
  });

  const t0 = new Date().getTime();

  const v = visibility.reduce((a, x) => a + x);
  console.log(
    `%c${(t1 - t2).toFixed(2)} ms  ${(t0 - t1).toFixed(2)} ms` +
      `  %cminWeight = ${maxWeight.toFixed(1)}` +
      `  %cpass1-dot = ${pass1}  pass2-pop = ${pass2}  pass3-ovr = ${pass3}` +
      `  %cvisible = ${indices.length} --> ${v}`,
    "color: blue",
    "font-weight: bold",
    "font-weight: normal",
    "color: green, font-weight: bold"
  );

  return visibility;
}

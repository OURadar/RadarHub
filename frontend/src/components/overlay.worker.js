//
//  overlay.worker.js
//  RadarHub
//
//  A separate web worker to compute the visibility of the labels.
//  This task is time-consuming so it is offloaded to a separate
//  thread for asynchronous operation.
//
//  Created by Boonleng Cheong
//

// A variable to store the arrays of label attributes
let labels = {
  points: [[]],
  extents: [[]],
  weights: [],
};

self.onmessage = ({ data: { type, payload } }) => {
  if (type == "init") {
    labels = payload;
    self.postMessage({
      type: "init",
      payload: "ready",
    });
  } else if (type == "revise") {
    if (labels.points.length == 0) return;
    const opacity = reviseOpacity(payload);
    self.postMessage({
      type: "opacity",
      payload: opacity,
    });
  }
};

// Viewpoint is always 2R from the center of the sphere
// Maximum visible longitude = acos(R / 2R) = 1.047, no need to go extreme
function reviseOpacity(geometry, verbose = 0) {
  let pass1 = 0;
  let pass2 = 0;
  let pass3 = 0;
  let indices = [];
  let rectangles = [];
  let visibility = new Array(labels.points.length).fill(0);

  const t2 = Date.now();

  const viewportWidth = geometry.viewport.width;
  const viewportHeight = geometry.viewport.height;
  const maxWeight = getMaxWeight(geometry.fov);
  const theta = Math.cos(Math.min(0.9, geometry.fov));

  for (let k = 0, l = labels.points.length; k < l; k++) {
    if (ndot(geometry.satPosition, labels.points[k]) < theta) {
      pass1++;
      continue;
    }

    if (labels.weights[k] > maxWeight) {
      pass2++;
      continue;
    }

    visibility[k] = 1;
    const w = labels.extents[k][0];
    const h = labels.extents[k][1];
    const t = transformMat4([], labels.points[k], geometry.viewprojection);
    const x = (t[0] / t[3]) * viewportWidth;
    const y = (t[1] / t[3]) * viewportHeight;
    const rect = [x - w, y - h, x + w, y + h];
    rectangles.push(rect);
    indices.push(k);
  }

  const t1 = Date.now();

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

  const t0 = Date.now();

  if (verbose) {
    const v = visibility.reduce((a, x) => a + x);
    pass1 = pass1.toLocaleString();
    pass2 = pass2.toLocaleString();
    pass3 = pass3.toLocaleString();
    console.log(
      `%c${t1 - t2} ms / ${t0 - t1} ms` +
        `  %cfov = ${geometry.fov.toFixed(3)}` +
        `  theta = ${theta.toFixed(4)}` +
        `  maxWeight = ${maxWeight}` +
        `  %cpass1-dot = ${pass1}  pass2-pop = ${pass2}  pass3-ovr = ${pass3}` +
        `  %cvisible = ${indices.length} --> ${v}`,
      "color: lightseagreen",
      "font-weight: bold",
      "font-weight: normal",
      "color: green, font-weight: bold"
    );
  }

  return visibility;
}

function getMaxWeight(fov) {
  if (fov < 0.018) return 9;
  if (fov < 0.024) return 8;
  if (fov < 0.03) return 7;
  if (fov < 0.06) return 6;
  if (fov < 0.5) return 5;
  if (fov < 1.0) return 4;
  return 3;
}

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
 * Normalized dot product between two vectors
 *
 * @param {*} a input vector 1
 * @param {*} b input vector 2
 * @returns out
 */
function ndot(a, b) {
  const m = Math.hypot(a[0], a[1], a[2]);
  const n = Math.hypot(b[0], b[1], b[2]);
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return dot / (m * n);
}

gl = require("gl-matrix");
const mat4 = gl.mat4;
const vec3 = gl.vec3;
const quat = gl.quat;

const earthRadius = 6371.0;

//

function speed_test() {
  console.log("Speed Tests");
  console.log("===========");
  console.log("mat4.fromRotationTranslation()");

  let dest = mat4.create();
  let quatMat = mat4.create();
  let v = vec3.fromValues(1, 2, 4);
  let q = quat.fromValues(1, 0, 0, 0.25);

  let t = performance.now();

  const count = 10000000;

  for (let k = 0; k < count; k++) {
    mat4.fromTranslation(dest, v);
    mat4.fromQuat(quatMat, q);
    mat4.multiply(dest, dest, quatMat);
  }

  dt1 = performance.now() - t;

  console.log(`Elapsed time = ${dt1.toFixed(4)} ms`);
  console.log(dest);
  console.log("===");

  t = performance.now();

  for (let k = 0; k < count; k++) {
    mat4.fromRotationTranslation(dest, q, v);
  }

  dt2 = performance.now() - t;

  console.log(`Elapsed time = ${dt2.toFixed(4)} ms`);
  console.log(dest);

  let ratio = dt1 / dt2;

  console.log(`Ratio = ${ratio.toFixed(2)}`);
}

console.log("===");

function dolly_test() {
  let longitude = -97.422413;
  let latitude = 35.25527;

  let f = 1.2;
  let r = 169.0;
  let v = vec3.fromValues(0, 0, earthRadius);
  let e = vec3.fromValues(0, -0.01, r);

  // The radar
  let model = mat4.create();
  let quaternion = quat.create();
  quat.fromEuler(quaternion, -latitude, longitude, 0);
  mat4.fromQuat(model, quaternion);
  mat4.translate(model, model, v);
  // mat4.getTranslation(v, model);
  // mat4.getRotation(quaternion, model);
  // mat4.fromRotationTranslation(model, quaternion, v);

  // Te target
  let targetModel = mat4.clone(model);
  let targetTranslation = vec3.create();
  let targetQuaternion = quat.create();
  let targetScale = vec3.create();
  mat4.scale(targetModel, targetModel, [0.03, 0.03, 0.03]);
  mat4.getTranslation(targetTranslation, targetModel);
  mat4.getRotation(targetQuaternion, targetModel);
  mat4.getScaling(targetScale, targetModel);

  // The eye
  let eyeModel = mat4.clone(model);
  let eyeTranslation = vec3.create();
  let eyeQuaternion = quat.create();
  let eyeScale = vec3.create();
  let b = r * f;
  mat4.translate(eyeModel, eyeModel, e);
  mat4.scale(eyeModel, eyeModel, [b, b, r]);
  mat4.getTranslation(eyeTranslation, eyeModel);
  mat4.getRotation(eyeQuaternion, eyeModel);
  mat4.getScaling(eyeScale, eyeModel);
  // mat4.fromRotationTranslationScale(
  //   eyeModel,
  //   eyeQuaternion,
  //   eyeTranslation,
  //   eyeScale
  // );

  geo = {
    fov: f,
    eye: {
      range: r,
      model: eyeModel,
      quaternion: eyeQuaternion,
      translation: eyeTranslation,
      scale: eyeScale,
      up: vec3.fromValues(0, 1, 0),
    },
    target: {
      range: earthRadius,
      model: targetModel,
      quaternion: targetQuaternion,
      translation: targetTranslation,
      scale: targetScale,
    },
    view: mat4.create(),
    projection: mat4.create(),
  };

  updateProjection(geo);

  console.log("---");

  dolly(geo, 1);

  console.log("---");

  show(geo);
}

function dolly(geo, m) {
  let q = geo.eye.quaternion;
  let t = geo.eye.translation;
  let s = geo.eye.scale;
  let d = vec3.subtract([], t, geo.target.translation);
  let l = vec3.length(d);
  // console.log(`d = ${vec3.string(d)} (${l.toFixed(2)})  [ m = ${m} ]`);
  let n = clamp(l / m, 10, 1.2 * earthRadius);
  vec3.scale(d, d, n / l);
  // console.log(`d = ${vec3.string(d)} (${l.toFixed(2)})  [ m = ${m} ]`);
  let b = l * geo.fov;
  vec3.set(s, b, b, l);
  geo.eye.range = l;

  console.log("...");
  show(geo);

  // console.log("d = " + vec3.string(d));
  vec3.add(t, geo.target.translation, d);
  // console.log("t = " + vec3.string(t));
  console.log("...");

  show(geo);
  console.log("...");

  mat4.fromRotationTranslationScale(geo.eye.model, q, t, s);
  show(geo);

  updateProjection(geo);

  return geo;
}

function updateProjection(geo) {
  const t = geo.target.translation;
  const e = geo.eye.translation;

  let u = vec3.fromValues(geo.eye.model[4], geo.eye.model[5], geo.eye.model[6]);
  vec3.normalize(u, u);

  console.log("u = " + vec3.string(u));

  mat4.lookAt(geo.view, e, t, u);

  return geo;
}

function clamp(x, lo, hi) {
  return Math.min(Math.max(x, lo), hi);
}

mat4.string = function (m, precision = 3) {
  let u0 = m[0].toFixed(precision);
  let u1 = m[1].toFixed(precision);
  let u2 = m[2].toFixed(precision);

  let v0 = m[4].toFixed(precision);
  let v1 = m[5].toFixed(precision);
  let v2 = m[6].toFixed(precision);

  let w0 = m[8].toFixed(precision);
  let w1 = m[9].toFixed(precision);
  let w2 = m[10].toFixed(precision);

  return `${u0} ${u1} ${u2}   ${v0} ${v1} ${v2}   ${w0} ${w1} ${w2}`;
};

vec3.string = function (v, precision = 3) {
  let v0 = v[0].toFixed(precision);
  let v1 = v[1].toFixed(precision);
  let v2 = v[2].toFixed(precision);

  return `${v0} ${v1} ${v2}`;
};

quat.string = function (v, precision = 3) {
  let v0 = v[0].toFixed(precision);
  let v1 = v[1].toFixed(precision);
  let v2 = v[2].toFixed(precision);
  let v3 = v[3].toFixed(precision);

  return `${v0} ${v1} ${v2} ${v3}`;
};

function show(geo) {
  let u = vec3.fromValues(geo.eye.model[4], geo.eye.model[5], geo.eye.model[6]);
  vec3.normalize(u, u);
  let m = quat.length(geo.eye.quaternion).toFixed(4);
  console.log("m = " + mat4.string(geo.eye.model));
  console.log("q = " + quat.string(geo.eye.quaternion) + ` (${m})`);
  console.log("v = " + vec3.string(geo.eye.translation));
  console.log("s = " + vec3.string(geo.eye.scale));
  console.log("u = " + vec3.string(u));
}

//

dolly_test();

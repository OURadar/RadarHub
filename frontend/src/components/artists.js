//
//  artists.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import { roundCapJoinGeometry } from "./instanced";

//  A simple 2D artist with basic shaders
export function basic(regl) {
  return regl({
    vert: `
        precision highp float;
        uniform vec4 color;
        uniform mat4 projection;
        attribute vec2 position;
        void main() {
            gl_Position = projection * vec4(position, 0.0, 1.0);
        }`,

    frag: `
        precision highp float;
        uniform vec4 color;
        void main() {
          gl_FragColor = color;
        }`,

    uniforms: {
      color: regl.prop("color"),
      projection: regl.prop("projection"),
    },

    attributes: {
      position: regl.prop("points"),
    },

    depth: {
      enable: false,
    },

    primitive: regl.prop("primitive"),
    viewport: regl.prop("viewport"),
    count: regl.prop("count"),
    blend: {
      enable: true,
      func: {
        src: "src alpha",
        dst: "one minus src alpha",
      },
    },
  });
}

// A point drawing artist to paint points based on a large texture
export function sprite(regl) {
  return regl({
    vert: `
      precision highp float;
      uniform float scale;
      uniform mat4 projection;
      attribute vec2 position;
      attribute vec2 origin;
      attribute vec2 spread;
      varying float size;
      varying vec2 uv;
      varying vec2 wh;
      varying vec2 mn;
      void main()	{
          uv = origin;
          wh = spread;
          size = max(spread.x, spread.y);
          gl_Position = projection * vec4(position, 0.0, 1.0);
          gl_PointSize = scale * size;
      }`,

    frag: `
      precision highp float;
      uniform sampler2D texture;
      uniform vec2 bound;
      uniform vec4 color;
      varying float size;
      varying vec2 uv;
      varying vec2 wh;
      varying vec2 mn;

      void main()	{
          vec2 q = gl_PointCoord;
          vec2 p = (uv + q * size - 0.5 * (size - wh)) / bound;
          if (any(lessThan(q, 0.5 * (size - wh) / size)) ||
              any(greaterThan(q, 0.5 * (size + wh) / size))) {
              gl_FragColor = color;
          } else {
              gl_FragColor = texture2D(texture, p);
          }
      }`,

    uniforms: {
      color: regl.prop("color"),
      projection: regl.prop("projection"),
      scale: regl.prop("scale"),
      bound: regl.prop("bound"),
      texture: regl.prop("texture"),
    },

    attributes: {
      position: regl.prop("points"),
      origin: regl.prop("origin"),
      spread: regl.prop("spread"),
    },

    depth: {
      enable: false,
    },

    primitive: "points",
    viewport: regl.prop("viewport"),
    count: regl.prop("count"),
    blend: {
      enable: true,
      func: {
        src: "src alpha",
        dst: "one minus src alpha",
      },
    },
  });
}

//  A simple 3D artist with basic shaders
export function basic3(regl) {
  return regl({
    vert: `
    precision highp float;
    attribute vec3 position;
    uniform mat4 projection;
    void main() {
      gl_Position = projection * vec4(position, 1);
    }`,

    frag: `
    precision highp float;
    uniform vec4 color;
    void main() {
      gl_FragColor = color;
    }`,

    uniforms: {
      color: regl.prop("color"),
      projection: regl.prop("projection"),
    },

    attributes: {
      position: regl.prop("points"),
    },

    primitive: regl.prop("primitive"),
    viewport: regl.prop("viewport"),
    count: regl.prop("count"),
  });
}

export function element3(regl) {
  return regl({
    vert: `
    precision highp float;
    attribute vec3 position;
    uniform mat4 modelview;
    uniform mat4 projection;
    varying vec3 n;
    varying float s;
    void main() {
      gl_Position = projection * modelview * vec4(position, 1.0);
      n = mat3(modelview) * normalize(position);
      s = dot(vec3(0.0, 0.0, 1.0), n);
      s = clamp(0.4 + 0.6 * s, 0.0, 1.0);
    }`,

    frag: `
    precision highp float;
    uniform vec4 color;
    varying float s;
    void main() {
      gl_FragColor = vec4(color.rgb, s);
    }`,

    uniforms: {
      color: regl.prop("color"),
      modelview: regl.prop("modelview"),
      projection: regl.prop("projection"),
    },

    attributes: {
      position: regl.prop("points"),
    },

    primitive: regl.prop("primitive"),
    elements: regl.prop("elements"),
    viewport: regl.prop("viewport"),

    blend: {
      enable: true,
      func: {
        src: "src alpha",
        dst: "one minus src alpha",
      },
    },
  });
}

const earth = require("./earth-grid");

export function sphere(regl) {
  return regl({
    vert: `
    precision highp float;
    attribute vec3 position;
    uniform mat4 modelview;
    uniform mat4 projection;
    varying float s;
    vec3 n;
    void main() {
      gl_Position = projection * modelview * vec4(position, 1.0);
      n = mat3(modelview) * normalize(position);
      s = dot(vec3(0.0, 0.0, 1.3), n);
      s = clamp(s, 0.2, 1.0);
    }`,

    frag: `
    precision highp float;
    uniform vec4 color;
    varying float s;
    void main() {
      gl_FragColor = vec4(color.rgb * s, color.a * s);
    }`,

    uniforms: {
      modelview: regl.prop("modelview"),
      projection: regl.prop("projection"),
      color: regl.prop("color"),
    },

    attributes: {
      position: earth.points,
    },

    primitive: "lines",
    elements: earth.elements,
    viewport: regl.prop("viewport"),

    blend: {
      enable: true,
      func: {
        src: "src alpha",
        dst: "one minus src alpha",
      },
    },
  });
}

// A point drawing artist to paint points based on a large texture
export function sprite3(regl) {
  return regl({
    vert: `
      precision highp float;
      uniform float scale;
      uniform mat4 projection;
      attribute vec3 position;
      attribute vec2 origin;
      attribute vec2 spread;
      varying float size;
      varying vec2 uv;
      varying vec2 wh;
      varying vec2 mn;
      void main()	{
          uv = origin;
          wh = spread;
          size = max(spread.x, spread.y);
          gl_Position = projection * vec4(position, 1.0);
          gl_PointSize = scale * size;
      }`,

    frag: `
      precision highp float;
      uniform sampler2D texture;
      uniform vec2 bound;
      uniform vec4 color;
      varying float size;
      varying vec2 uv;
      varying vec2 wh;
      varying vec2 mn;
      void main()	{
          vec2 q = gl_PointCoord;
          vec2 p = (uv + q * size - 0.5 * (size - wh)) / bound;
          if (any(lessThan(q, 0.5 * (size - wh) / size)) ||
              any(greaterThan(q, 0.5 * (size + wh) / size))) {
              gl_FragColor = color;
          } else {
              gl_FragColor = texture2D(texture, p);
          }
      }`,

    uniforms: {
      color: regl.prop("color"),
      projection: regl.prop("projection"),
      scale: regl.prop("scale"),
      bound: regl.prop("bound"),
      texture: regl.prop("texture"),
    },

    attributes: {
      position: regl.prop("points"),
      origin: regl.prop("origins"),
      spread: regl.prop("spreads"),
    },

    depth: {
      enable: false,
    },

    primitive: "points",
    viewport: regl.prop("viewport"),
    count: regl.prop("count"),
    blend: {
      enable: true,
      func: {
        src: "src alpha",
        dst: "one minus src alpha",
      },
    },
  });
}

//
// modified from interleavedStripRoundCapJoin3D()
// Each segment is indepedent. The end point of the previous segment is not reused.
// Why? This method is meant for a single draw call to draw many line loops, reusing
// the previous end point is not appropriate. The trade-off is, of course, more memory
// usage but there is a lot more memory than compute here.
//
export function instancedLines(regl, resolution) {
  const roundCapJoin = roundCapJoinGeometry(regl, resolution);
  return regl({
    vert: `
      precision highp float;
      attribute vec3 position;
      attribute vec3 pointA, pointB;
      uniform float width;
      uniform vec2 resolution;
      uniform mat4 model, view, projection;
      uniform vec4 color;
      uniform vec4 quad;
      varying vec4 normal;
      varying vec4 adjustedColor;

      void main() {
        vec4 modelPointA = model * vec4(pointA, 1.0);
        vec4 modelPointB = model * vec4(pointB, 1.0);
        vec4 clip0 = projection * view * modelPointA;
        vec4 clip1 = projection * view * modelPointB;
        vec2 screen0 = resolution * (0.5 * clip0.xy/clip0.w + 0.5);
        vec2 screen1 = resolution * (0.5 * clip1.xy/clip1.w + 0.5);
        vec2 xBasis = normalize(screen1 - screen0);
        vec2 yBasis = vec2(-xBasis.y, xBasis.x);
        vec2 pt0 = screen0 + width * (position.x * xBasis + position.y * yBasis);
        vec2 pt1 = screen1 + width * (position.x * xBasis + position.y * yBasis);
        vec2 pt = mix(pt0, pt1, position.z);
        vec4 clip = mix(clip0, clip1, position.z);
        gl_Position = vec4(clip.w * (2.0 * pt/resolution - 1.0), clip.z, clip.w);
        normal.xyz = normalize(mat3(view) * modelPointA.xyz);
        normal.w = clamp(dot(vec3(0.0, 0.0, 1.3), normal.xyz), 0.05, 1.0) * quad.a;
        normal.xyz *= quad.y;
        adjustedColor = color;
        adjustedColor.a *= normal.w;
      }`,

    frag: `
      precision highp float;
      uniform vec4 quad;
      varying vec4 normal;
      varying vec4 adjustedColor;
      void main() {
        if (normal.w < 0.05)
          discard;
        vec4 computedColor = vec4(normal.xzy * normal.w, normal.w);
        gl_FragColor = mix(computedColor, adjustedColor, quad.x);
      }`,

    attributes: {
      position: {
        buffer: roundCapJoin.buffer,
        divisor: 0,
        stride: Float32Array.BYTES_PER_ELEMENT * 3,
      },
      pointA: {
        buffer: regl.prop("points"),
        divisor: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 0,
        stride: Float32Array.BYTES_PER_ELEMENT * 6,
      },
      pointB: {
        buffer: regl.prop("points"),
        divisor: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 3,
        stride: Float32Array.BYTES_PER_ELEMENT * 6,
      },
    },

    uniforms: {
      width: regl.prop("width"),
      color: regl.prop("color"),
      quad: regl.prop("quad"),
      model: regl.prop("model"),
      view: regl.prop("view"),
      projection: regl.prop("projection"),
      resolution: regl.prop("resolution"),
    },

    depth: {
      enable: false,
    },

    blend: {
      enable: true,
      func: {
        src: "src alpha",
        dst: "one minus src alpha",
      },
    },

    count: roundCapJoin.count,
    instances: regl.prop("segments"),
    viewport: regl.prop("viewport"),
  });
}

//
// modified from interleavedStripRoundCapJoin3D() for drawing map polygons
// where model matrix is always an identity matrix and, therefore, it's omitted
//
export function simplifiedInstancedLines(regl) {
  const roundCapJoin = roundCapJoinGeometry(regl, 4);
  return regl({
    vert: `
    precision highp float;
    attribute vec3 position;
      attribute vec3 pointA, pointB;
      uniform float width;
      uniform vec2 resolution;
      uniform mat4 view, projection;
      uniform vec4 color;
      uniform vec4 quad;
      varying vec4 normal;
      varying vec4 adjustedColor;

      void main() {
        vec4 modelPointA = vec4(pointA, 1.0);
        vec4 modelPointB = vec4(pointB, 1.0);
        mat4 mvp = projection * view;
        vec4 clip0 = mvp * modelPointA;
        vec4 clip1 = mvp * modelPointB;
        vec2 screen0 = resolution * (0.5 * clip0.xy / clip0.w + 0.5);
        vec2 screen1 = resolution * (0.5 * clip1.xy / clip1.w + 0.5);
        vec2 xBasis = normalize(screen1 - screen0);
        vec2 yBasis = vec2(-xBasis.y, xBasis.x);
        vec2 pt0 = screen0 + width * (position.x * xBasis + position.y * yBasis);
        vec2 pt1 = screen1 + width * (position.x * xBasis + position.y * yBasis);
        vec2 pt = mix(pt0, pt1, position.z);
        vec4 clip = mix(clip0, clip1, position.z);
        gl_Position = vec4(clip.w * (2.0 * pt / resolution - 1.0), clip.z, clip.w);
        normal.xyz = normalize(mat3(view) * pointA);
        normal.w = clamp(dot(vec3(0.0, 0.0, 1.3), normal.xyz), 0.05, 1.0) * quad.a;
        normal.xyz *= quad.y;
        adjustedColor = color;
        adjustedColor.a *= normal.w;
      }`,

    frag: `
      precision highp float;
      uniform vec4 quad;
      varying vec4 normal;
      varying vec4 adjustedColor;
      void main() {
        if (normal.w < 0.1)
          discard;
        vec4 computedColor = vec4(normal.xzy * normal.w, normal.w);
        gl_FragColor = mix(computedColor, adjustedColor, quad.x);
      }`,

    attributes: {
      position: {
        buffer: roundCapJoin.buffer,
        divisor: 0,
        stride: Float32Array.BYTES_PER_ELEMENT * 3,
      },
      pointA: {
        buffer: regl.prop("points"),
        divisor: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 0,
        stride: Float32Array.BYTES_PER_ELEMENT * 6,
      },
      pointB: {
        buffer: regl.prop("points"),
        divisor: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 3,
        stride: Float32Array.BYTES_PER_ELEMENT * 6,
      },
    },

    uniforms: {
      width: regl.prop("width"),
      color: regl.prop("color"),
      quad: regl.prop("quad"),
      view: regl.prop("view"),
      projection: regl.prop("projection"),
      resolution: regl.prop("resolution"),
    },

    depth: {
      enable: true,
    },

    blend: {
      enable: true,
      func: {
        src: "src alpha",
        dst: "one minus src alpha",
      },
    },

    count: roundCapJoin.count,
    instances: regl.prop("segments"),
    viewport: regl.prop("viewport"),
  });
}

// Rectangular patch instancing
export function instancedPatches(regl) {
  const buffer = regl.buffer([
    [-0.5, -0.5],
    [+0.5, -0.5],
    [+0.5, +0.5],
    [-0.5, -0.5],
    [+0.5, +0.5],
    [-0.5, +0.5],
  ]);
  return regl({
    vert: `
      precision highp float;
      uniform mat4 projection;
      uniform vec2 resolution;
      uniform vec2 bound;
      uniform float scale;
      attribute vec2 position;
      attribute vec3 point;
      attribute vec2 origin;
      attribute vec2 spread;
      varying vec2 uv;
      vec4 modelPoint;
      void main() {
        uv = position + 0.5;
        uv = (uv * spread + origin) / bound;
        modelPoint = projection * vec4(point, 1.0);
        modelPoint.xy += position * spread / scale / resolution * 2.0 * modelPoint.w;
        gl_Position = modelPoint;
      }`,

    frag: `
      precision highp float;
      uniform sampler2D texture;
      uniform vec2 bound;
      varying vec2 uv;
      void main() {
        gl_FragColor = texture2D(texture, uv);
      }`,

    attributes: {
      position: {
        buffer: buffer,
        divisor: 0,
      },
      point: {
        buffer: regl.prop("points"),
        divisor: 1,
      },
      origin: {
        buffer: regl.prop("origins"),
        divisor: 1,
      },
      spread: {
        buffer: regl.prop("spreads"),
        divisor: 1,
      },
    },

    uniforms: {
      projection: regl.prop("projection"),
      resolution: regl.prop("resolution"),
      texture: regl.prop("texture"),
      bound: regl.prop("bound"),
      scale: regl.prop("scale"),
    },

    depth: {
      enable: false,
    },

    blend: {
      enable: true,
      func: {
        src: "src alpha",
        dst: "one minus src alpha",
      },
    },

    count: 6,
    instances: regl.prop("count"),
    viewport: regl.prop("viewport"),
  });
}

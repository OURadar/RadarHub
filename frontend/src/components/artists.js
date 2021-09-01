//
//  artists.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

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
      enable: true,
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

//
//  ingest.worker.js
//  RadarHub
//
//  A separate web worker to ingest in the background
//
//  Created by Boonleng Cheong
//

let socket = null;
let radar;
let url;
let enums = {
  Definition: 1,
  Control: 1,
  Health: 1,
  Scope: 1,
  Response: 1,
  RadialZ: 1,
  RadialV: 1,
  RadialW: 1,
  RadialD: 1,
  RadialP: 1,
  RadialR: 1,
};
let message = "";
let wait = 0;

self.onmessage = ({ data: { task, payload } }) => {
  if (task == "connect") {
    radar = payload.radar || "demo";
    url = payload.url || "localhost:8000";
    if (url === undefined) {
      return self.postMessage({
        type: "message",
        payload: "Error using connect",
      });
    }
    connect(payload.radar || "demo", payload.url);
  } else if (task == "execute") {
    console.log(`Sending in command ${payload}`);
    socket?.send(
      JSON.stringify({
        command: "userMessage",
        payload: payload,
        radar: radar,
      })
    );
  }
};

function connect(newRadar, url) {
  radar = newRadar;
  self.postMessage({ type: "message", payload: "Connecting ..." });

  socket = new WebSocket(url);
  socket.binaryType = "arraybuffer";

  socket.onopen = (_e) => {
    self.postMessage({ type: "message", payload: "Hub Connected" });
    socket.send(
      JSON.stringify({
        radar: radar,
        command: "userConnect",
      })
    );
  };

  socket.onmessage = (e) => {
    const type = new Int8Array(e.data.slice(0, 1));
    // Interpret the data
    if (type == enums.Definition) {
      // Update payload definition
      const text = new TextDecoder().decode(e.data.slice(1));
      const update = JSON.parse(text);
      enums = { ...enums, ...update };
      //   console.log(enums);
    } else if (type == enums.Control) {
      // Control data in JSON
      const text = new TextDecoder().decode(e.data.slice(1));
      const dict = JSON.parse(text);
      if (dict.name == radar) {
        self.postMessage({
          type: "control",
          payload: dict.Controls,
        });
      } else {
        console.log(`dict.name = ${dict.name} /= ${radar}`);
      }
    } else if (type == enums.Health) {
      // Health data in JSON
      const text = new TextDecoder().decode(e.data.slice(1));
      const health = JSON.parse(text);
      self.postMessage({
        type: "health",
        payload: health,
      });
    } else if (type == enums.Scope) {
      // AScope data - convert arraybuffer to int16 typed array
      const samples = new Int16Array(e.data.slice(1));
      // Parse out the array into I/Q/A arrays for Scope
      const len = Math.floor(samples.length / 2);
      const i = new Float32Array(samples.slice(0, len));
      const q = new Float32Array(samples.slice(len));
      const a = new Float32Array(len);
      for (var k = 0; k < len; k++) {
        a[k] = Math.hypot(i[k], q[k]);
      }
      self.postMessage({
        type: "scope",
        payload: {
          ch1: {
            i: i,
            q: q,
            a: a,
          },
          ch2: {
            i: i,
            q: q,
            a: a,
          },
          count: len,
        },
      });
    } else if (type == enums.Response) {
      // Response of a command
      let text = new TextDecoder().decode(e.data.slice(1));
      if (text.includes("not") || text.includes("NAK")) {
        text = ` 👎🏼 ${text} <div class='emotion'>😿</div>`;
      } else {
        text = ` 👍🏼 ${text} <div class='emotion'>👻</div>`;
      }
      self.postMessage({
        type: "response",
        payload: text,
      });
    }
  };

  socket.onclose = (_e) => {
    wait = 5.0;
    message = "No connection";
    setTimeout(waitOrConnect, 200);
  };

  socket.onerror = (_e) => {
    socket.close();
  };
}

function waitOrConnect() {
  if (wait <= 0.5) {
    connect(radar, url);
  } else {
    const t = wait.toFixed(0);
    if (t <= 3) {
      message = `Connect in ${t} second${t > 1 ? "s" : ""}`;
      self.postMessage({
        type: "message",
        payload: message,
      });
    }
    setTimeout(waitOrConnect, 200);
    wait = wait - 0.2;
  }
}

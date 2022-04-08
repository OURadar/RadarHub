//
//  ingest.js
//  RadarHub
//
//  Created by Boonleng Cheong on 7/25/2021.
//

class Ingest {
  constructor(radar) {
    this.radar = radar;
    this.data = {
      t: null,
      ch1: {
        i: [],
        q: [],
        a: [],
      },
      ch2: {
        i: [],
        q: [],
        a: [],
      },
      health: { time: 0 },
      control: { time: 0 },
      ppi: {
        az: null,
        z: [],
      },
    };
    this.tic = 0;
    this.message = "";
    this.response = "";
    this.onupdate = (_data) => {};

    this.worker = new Worker("/static/frontend/ingest.js");
    this.worker.onmessage = ({ data: { type, payload } }) => {
      if (type == "message") {
        this.message = payload;
        setTimeout(() => {
          if (this.message == payload) {
            this.message = "";
            this.onupdate(this.tic++);
          }
        }, 2000);
      } else if (type == "scope") {
        //if (this.tic < 5) console.log(payload);
        this.data.ch1 = payload.ch1;
        this.data.ch2 = payload.ch2;
        if (this.data.t === null || this.data.t.length != payload.count) {
          this.data.t = new Float32Array(Array(payload.count).keys());
        }
      } else if (type == "health") {
        this.data.health = payload;
      } else if (type == "control") {
        this.data.control = payload;
      } else if (type == "response") {
        // console.log(payload);
        this.response = payload;
        setTimeout(() => {
          if (this.response == payload) {
            this.response = "";
            this.onupdate(this.tic++);
          }
        }, 2000);
      }
      this.onupdate(this.tic++);
    };

    this.connect = this.connect.bind(this);
    this.execute = this.execute.bind(this);
    this.disconnect = this.disconnect.bind(this);
  }

  connect() {
    this.message = "Connecting ...";
    this.onupdate(this.tic++);
    const p = window.location.protocol == "https:" ? "wss" : "ws";
    const url = `${p}://${window.location.host}/ws/${this.radar}/`;
    this.worker.postMessage({
      task: "connect",
      payload: {
        url: url,
        radar: this.radar,
      },
    });
  }

  execute(command) {
    this.worker.postMessage({
      task: "execute",
      payload: command,
    });
  }

  disconnect() {
    this.worker.postMessage({
      task: "disconnect",
    });
  }
}

export { Ingest };

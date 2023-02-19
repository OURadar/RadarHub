//
//  live.js
//  RadarHub
//
//  This is a model
//
//  Created by Boonleng Cheong on 7/25/2021.
//

import { Ingest } from "./ingest";

class Live extends Ingest {
  constructor(pathway, label = "") {
    super(pathway, label);

    this.data = {
      ...this.data,
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
    };

    this.connect = this.connect.bind(this);
    this.execute = this.execute.bind(this);
    this.disconnect = this.disconnect.bind(this);

    this.worker = new Worker(new URL("./live.worker.js", import.meta.url));
    this.worker.onmessage = this.handleMessage;
    this.init();
  }

  handleMessage({ data: { type, payload } }) {
    if (type == "message") {
      this.showMessage(payload);
    } else if (type == "response") {
      this.showResponse(payload, 2500);
    } else if (type == "scope") {
      //if (this.state.tic < 5) console.log(payload);
      this.data.ch1 = payload.ch1;
      this.data.ch2 = payload.ch2;
      if (this.data.t === null || this.data.t.length != payload.count) {
        this.data.t = new Float32Array(Array(payload.count).keys());
      }
    } else if (type == "health") {
      this.data.health = payload;
    } else if (type == "control") {
      this.data.control = payload;
    }
    this.onUpdate(this.state.tic++);
  }

  //

  init() {
    if (this.state.verbose) {
      console.log(
        `%live.init()%c   pathway = ${this.pathway}`,
        "color: lightseagreen",
        ""
      );
    }
    this.worker.postMessage({ task: "init", name: this.pathway });
    // this.worker.postMessage({ task: "init" });
  }

  connect() {
    this.message = "Connecting ...";
    this.onUpdate(this.state.tic++);
    const p = window.location.protocol == "https:" ? "wss" : "ws";
    const url = `${p}://${window.location.host}/ws/${this.pathway}/`;
    console.log(`live.js Connecting ${this.pathway}`)
    this.worker.postMessage({
      task: "connect",
      payload: {
        url: url,
        pathway: this.pathway,
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

export { Live };

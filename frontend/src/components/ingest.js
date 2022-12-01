//
//  ingest.js
//  RadarHub
//
//  This is a model
//
//  Created by Boonleng Cheong on 11/29/2022.
//

class Ingest {
  constructor(radar, label = "") {
    this.radar = radar;
    this.label = label == "" ? radar : label;
    this.ready = false;
    this.state = {
      tic: 0,
    };
    this.data = {
      sweep: null,
    };
    this.message = "";
    this.response = "";
    this.onUpdate = (_data) => {};
    this.onIndex = () => {};
    this.onList = () => {};
    this.onLoad = () => {};

    this.showMessage = this.showMessage.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
  }

  showMessage(message, duration = 2000) {
    this.message = message;
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => {
      if (this.message == message) {
        this.message = "";
        this.messageTimer = null;
        this.onUpdate(this.state.tic++);
      }
    }, duration);
  }

  handleMessage({ data: { type, payload } }) {
    console.log(`Ingest.handleMessage()`, type, payload);
  }
}

export { Ingest };

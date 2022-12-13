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
      verbose: 0,
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

  showResponse(message, duration = 2000) {
    console.log("parent.showResponse");
    this.response = message;
    if (this.responseTimer) clearTimeout(this.responseTimer);
    this.responseTimer = setTimeout(() => {
      if (this.response == message) {
        this.response = "";
        this.responseTimer = null;
        this.onUpdate(this.state.tic++);
      }
    }, duration);
  }

  // The method handleMessage() should be overriden in subclass
  handleMessage({ data: { type, payload } }) {
    if (type == "message") {
      this.showMessage(payload);
    } else if (type == "response") {
      this.showResponse(payload);
    } else {
      console.log(`Ingest.handleMessage()`, type, payload);
    }
  }
}

export { Ingest };

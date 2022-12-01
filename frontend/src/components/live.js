//
//  live.js
//  RadarHub
//
//  This is a model
//
//  Created by Boonleng Cheong on 11/29/2022.
//

class Live extends Ingest {
  constructor(radar, label = "") {
    this.radar = radar;
    this.label = label == "" ? radar : label;
  }
}

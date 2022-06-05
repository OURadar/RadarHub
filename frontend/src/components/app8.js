//
//  app8.js - Mobile / Desktop App
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import { colorDict, makeTheme } from "./theme";
import { detectMob, clamp } from "./common";

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      colors: colorDict(),
      theme: makeTheme(),
      time: new Date("2013-05-20T19:00"),
    };
    this.isMobile = detectMob();
  }
  static defaultProps = {
    radar: "radar",
    origin: {
      longitude: -97.422413,
      latitude: 35.25527,
    },
    debug: false,
    profileGL: false,
    autoLoad: true,
  };

  componentDidMount() {}
}

export default App;

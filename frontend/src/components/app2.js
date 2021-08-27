//
//  Archive.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import { ThemeProvider } from "@material-ui/core/styles";
import { colorDict, detectMob } from "./common";
import { SectionHeader } from "./simple";
import { Product } from "./product";
import { theme } from "./theme";
import { TopBar } from "./topbar";
import { GLView } from "./glview";

class App2 extends Component {
  constructor(props) {
    super(props);
    this.state = {
      colors: colorDict(),
      tic: 0,
    };
    this.isMobile = detectMob();
    console.log("isMobile = " + this.isMobile);
  }
  static defaultProps = {
    radar: "demo",
    receiver: 0,
  };

  render() {
    return (
      <ThemeProvider theme={theme}>
        <TopBar isMobile={this.isMobile} />
        <SectionHeader name="product" />
        <GLView debug={true} />
      </ThemeProvider>
    );
  }
}

export default App2;

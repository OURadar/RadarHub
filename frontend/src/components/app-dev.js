//
//  App2.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import { ThemeProvider } from "@material-ui/core/styles";
import { detectMob } from "./common";
import { SectionHeader } from "./section-header";
import { Product } from "./product";
import { theme, colorDict } from "./theme";
import { TopBar } from "./topbar";

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      colors: colorDict(),
      sweep: null,
    };
    this.isMobile = detectMob();
    console.log(props);
  }

  static defaultProps = {
    radar: "demo",
    debug: false,
    profileGL: false,
  };

  componentDidMount() {
    // Get notified when the desktop theme is changed
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (e) => {
        if (e.matches) {
          this.setState({
            colors: colorDict("dark"),
          });
        } else {
          this.setState({
            colors: colorDict("light"),
          });
        }
      });

    // fetch("/data/binary/PX-20200520-060102")
    //   .then((resp) => resp.arrayBuffer())
    //   .then((data) => {
    //     var elev = new Float32Array(data.slice(0, 4));
    //     var bytes = new Uint8Array(data.slice(4));
    //     console.log(`elev = ${elev}`);
    //     console.log(bytes);
    //   });

    // fetch("/data/header/PX-20130520-191140-E2.6-Z.nc/")
    //   .then((resp) => resp.json())
    //   .then((data) => {
    //     console.log(data);
    //   });

    var Parser = require("binary-parser").Parser;

    var sweepParser = new Parser()
      .endianess("little")
      .uint16("na")
      .uint16("nr")
      .array("azimuth", { type: "floatle", length: "na" })
      .array("values", {
        type: "uint8",
        length: function () {
          return this.na * this.nr;
        },
      });

    const url = "/data/file/PX-20130520-191141-E2.6-Z.nc/"; // not in database
    // const url = "/data/file/PX-20130520-191140-E2.6-Z.nc/";

    fetch(url)
      .then((response) => {
        if (response.status == 200)
          response.arrayBuffer().then((data) => {
            const buff = new Uint8Array(data);
            this.setState({
              sweep: sweepParser.parse(buff),
            });
          });
        else
          response.text().then((error) => {
            console.log(error);
          });
      })
      .catch((error) => {
        console.log(`Unexpected error ${error}`);
      });
  }

  render() {
    return (
      <ThemeProvider theme={theme}>
        <TopBar isMobile={this.isMobile} />
        <SectionHeader name="product" />
        <Product
          sweep={this.state.sweep}
          colors={this.state.colors}
          debug={this.props.debug}
          showStats={true}
          profileGL={this.props.profileGL}
        />
      </ThemeProvider>
    );
  }
}

export default App;

//
//  App2.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import { ThemeProvider } from "@material-ui/core/styles";
import { colorDict, detectMob } from "./common";
import { SectionHeader } from "./section-header";
import { Product } from "./product";
import { theme } from "./theme";
import { TopBar } from "./topbar";

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      colors: colorDict(),
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

    fetch("/data/binary/PX-20200520-060102")
      .then((resp) => resp.arrayBuffer())
      .then((data) => {
        var elev = new Float32Array(data.slice(0, 4));
        var bytes = new Uint8Array(data.slice(4));
        console.log(`elev = ${elev}`);
        console.log(bytes);
      });

    fetch("/data/header/PX-20200520-060102")
      .then((resp) => resp.json())
      .then((data) => {
        console.log(data);
      });

    fetch("/data/file/PX-20200520-060102")
      .then((resp) => resp.arrayBuffer())
      .then((data) => {
        var head = new Int16Array(data.slice(0, 4));
        const [na, nr] = head;
        console.log(`nr = ${nr}   na = ${na}`);
        var azimuths = new Float32Array(
          data.slice(4, 4 + na * Float32Array.BYTES_PER_ELEMENT)
        );
        console.log(azimuths);
        var values = new Float32Array(
          data.slice(4 + na * Float32Array.BYTES_PER_ELEMENT)
        );
        console.log(values);
      });
  }

  render() {
    return (
      <ThemeProvider theme={theme}>
        <TopBar isMobile={this.isMobile} />
        <SectionHeader name="product" />
        <Product
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

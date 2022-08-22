//
//  app-intro.js - Topbar Only
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { colorDict, makeTheme } from "./theme";
import { detectMob } from "./common";
import { TopBar } from "./topbar";
import { HelpPage } from "./help";

const emojis = require("emoji-name-map");

const version = require("/package.json").version;

class App extends Component {
  constructor(props) {
    super(props);
    this.isMobile = detectMob();
    if (this.isMobile)
      document
        .getElementById("device-style")
        .setAttribute(
          "href",
          `/static/css/mobile.css?h=${this.props.css_hash}`
        );
    this.state = {
      colors: colorDict(),
      theme: makeTheme(),
      message: "",
      time: new Date("2013-05-20T19:00"),
      open: false,
    };
    this.handleAccount = this.handleAccount.bind(this);
    this.handleInfoOpen = this.handleInfoOpen.bind(this);
    this.handleInfoClose = this.handleInfoClose.bind(this);
    this.handleThemeChange = this.handleThemeChange.bind(this);
  }
  static defaultProps = {
    debug: false,
  };

  componentDidMount() {
    // Get notified when the desktop theme is changed
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (e) => {
        let mode = e.matches ? "dark" : "light";
        this.setState({
          colors: colorDict(mode),
          theme: makeTheme(mode),
        });
      });
    document.getElementById("versionTag").innerHTML = `v${version}`;
  }

  render() {
    return (
      <ThemeProvider theme={this.state.theme}>
        <TopBar
          mode={this.state.colors.name}
          isMobile={this.isMobile}
          message={this.state.message}
          onThemeChange={this.handleThemeChange}
          onInfoRequest={this.handleInfoOpen}
          onAccount={this.handleAccount}
        />
        <HelpPage open={this.state.open} handleClose={this.handleInfoClose} />
      </ThemeProvider>
    );
  }

  handleAccount() {
    console.log("App.handleAccount()");
    this.setState({ message: "Fetching User Information ..." });
    fetch("/profile/")
      .then((response) => {
        if (response.status == 200) {
          response.json().then(({ user, ip, emoji }) => {
            let title = user == "None" ? "Anonymous User" : `Hello ${user}`;
            let symbol = emojis.get(emoji) || "";
            this.setState({
              message:
                user == "None"
                  ? "<h3>Guest</h3><a class='link darken' href='/accounts/signin/?next=" +
                    window.location.pathname +
                    "'>Sign In Here</a><div class='emotion'>⛅️</div>"
                  : `<h3>${title}</h3>${ip}<div class='emotion'>${symbol}</div>`,
            });
            setTimeout(() => this.setState({ message: "" }), 3500);
          });
        } else {
          this.setState({
            message: `<h3>Error</h3>Received ${response.status}<div class='emotion'>🤷🏻‍♀️</div>`,
          });
        }
      })
      .catch((_error) => {
        this.setState({
          message: `<h3>Error</h3>Received ${response.status}<div class='emotion'>🤷🏻‍♀️</div>`,
        });
        console.error(_error);
        setTimeout(() => setMessage(""), 3500);
      });
  }

  handleThemeChange() {
    let mode = this.state.colors.name == "light" ? "dark" : "light";
    document.documentElement.setAttribute("theme", mode);
    this.setState({
      colors: colorDict(mode),
      theme: makeTheme(mode),
    });
  }

  handleInfoOpen() {
    this.setState({ open: true });
  }

  handleInfoClose() {
    this.setState({ open: false });
  }
}

export default App;

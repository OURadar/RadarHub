//
//  user.js
//  RadarHub
//
//  This is a model
//
//  Created by Boonleng Cheong on 8/25/2022.
//

import { colorDict, makeTheme } from "./theme";
import { Emoji } from "./emoji";

const key = "radarhub-user-preference";
const nameStyle = "background-color: #7a3; color: white; padding: 2px 4px; border-radius: 3px; margin: -2px 0";
const emojiMap = new Emoji();

class User {
  constructor() {
    this.user = undefined;
    this.email = undefined;
    this.preference = { mode: "auto", update: "scan", agree: false, colors: {}, theme: {} };

    this.save = this.save.bind(this);
    this.greet = this.greet.bind(this);
    this.retrieve = this.retrieve.bind(this);
    this.setMode = this.setMode.bind(this);

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      let mode = e.matches ? "dark" : "light";
      console.log(`%cUser%c ${mode}`, nameStyle, "");
      this.setMode(mode);
    });

    this.onMessage = (message) => console.log(`Account.onMessage() ${message}`);
    this.onUpdate = () => {};

    let m = localStorage.getItem(key);
    try {
      m = JSON.parse(m);
      this.preference = { ...this.preference, ...m };
    } catch (e) {
      this.save();
    }
    this.setMode(this.preference.mode);
    console.log("preference", this.preference);
  }

  save() {
    localStorage.setItem(key, JSON.stringify(this.preference));
  }

  greet() {
    this.onMessage("Fetching User Information ...");
    this.retrieve();
  }

  retrieve() {
    fetch("/profile/")
      .then((response) => {
        if (response.status == 200) {
          response.json().then(({ user, ip, emoji }) => {
            let title = user == "None" ? "Anonymous User" : `Hello ${user}`;
            let symbol = emojiMap.get(emoji) || "";
            this.onMessage(
              user == "None"
                ? "<h3>Guest</h3><a class='link darken' href='/accounts/signin/?next=" +
                    window.location.pathname +
                    "'>Sign In Here</a><div class='emotion'>⛅️</div>"
                : `<h3>${title}</h3>${ip}<div class='emotion'>${symbol}</div>`
            );
            setTimeout(() => this.onMessage(""), 4000);
          });
        } else {
          console.log("response", response);
          this.onMessage(`<h3>Error</h3>Received ${response.status}<div class='emotion'>🤷🏻‍♀️</div>`);
        }
      })
      .catch((error) => {
        this.onMessage(`<h3>Error</h3>Something went wrong<div class='emotion'>🤷🏻‍♀️</div>`);
        console.error(error);
      });
  }

  setMode(mode = "auto") {
    this.preference.mode = (["auto", "dark", "light"].includes(mode) && mode) || "auto";
    this.preference.theme = makeTheme(this.preference.mode);
    this.preference.colors = colorDict(this.preference.mode);
    document.documentElement.setAttribute("theme", this.preference.colors.name);
    this.onUpdate();
    this.save();
  }

  nextMode() {
    let mode = { auto: "light", light: "dark", dark: "auto" }[this.preference.mode];
    // console.log(`%cUser%c ${mode}`, nameStyle, "");
    this.setMode(mode);
  }

  setUpdate(mode = "scan") {
    this.preference.update = (["scan", "always", "offline"].includes(mode) && mode) || "scan";
    this.save();
  }

  setAgree(mode = true) {
    this.preference.agree = ([true, false].includes(mode) && mode) || false;
    console.log(`%cUser.setAgree%c ${mode}`, nameStyle, "");
    this.save();
  }

  getThemeItemHeight() {
    let h = 20;
    this.preference.theme.components.MuiButton.variants.forEach((variant) => {
      if (variant.props.variant == "file" && variant.style.height !== undefined) {
        h = variant.style.height;
        return false;
      }
    });
    return h;
  }
}

export { User };

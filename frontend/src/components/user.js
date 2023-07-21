//
//  user.js
//  RadarHub
//
//  This is a model
//
//  Created by Boonleng Cheong on 8/25/2022.
//

const emojis = require("emoji-name-map");
const key = "radarhub-user-preference";

class User {
  constructor() {
    this.user = undefined;
    this.email = undefined;
    this.preference = { mode: "auto", update: "scan" };
    let m = localStorage.getItem(key);
    try {
      m = JSON.parse(m);
      this.preference = { ...this.preference, ...m };
    } catch (e) {
      this.save();
    }
    // console.log("Loaded preference", this.preference);

    this.onMessage = (message) => {
      console.log(`Account.onMessage() ${message}`);
    };

    this.save = this.save.bind(this);
    this.greet = this.greet.bind(this);
    this.retrieve = this.retrieve.bind(this);
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
            let symbol = emojis.get(emoji) || "";
            this.onMessage(
              user == "None"
                ? "<h3>Guest</h3><a class='link darken' href='/accounts/signin/?next=" +
                    window.location.pathname +
                    "'>Sign In Here</a><div class='emotion'>⛅️</div>"
                : `<h3>${title}</h3>${ip}<div class='emotion'>${symbol}</div>`
            );
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
    this.save();
  }

  setUpdate(mode = "scan") {
    this.preference.update = (["scan", "always", "offline"].includes(mode) && mode) || "scan";
    this.save();
  }
}

export { User };

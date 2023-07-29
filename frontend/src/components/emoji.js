import emoji from "emojilib";

export class Emoji {
  constructor() {
    const emojis = Object.keys(emoji);
    this.map = {};
    emojis.forEach((s) => {
      emoji[s].forEach((name) => {
        if (name in this.map) return;
        this.map[name] = s;
      });
    });
  }

  get(name) {
    if (name[0] == ":") name = name.slice(1, -1);
    if (name in this.map) return this.map[name];
    return "-";
  }
}

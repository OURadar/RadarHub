import React from "react";
import Button from "@material-ui/core/Button";
import { SectionHeader } from "./section-header";
import { Archive } from "./archive";

import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";

function Browser(props) {
  const files = [];
  const retriever = new Archive();

  const entries = [];
  for (let k = 0; k < 5; k++) {
    entries.push(<Button key={`file-${k}`}>File {k}</Button>);
  }
  return (
    <div>
      <SectionHeader name="archive" />
      {entries}
    </div>
  );
}

export { Browser };

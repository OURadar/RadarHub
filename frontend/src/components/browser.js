import React from "react";
import Button from "@material-ui/core/Button";
import { SectionHeader } from "./section-header";

import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";

function Browser(props) {
  const files = props.archive?.data.list || [];
  const items = [];
  for (let k = 0; k < files.length; k++) {
    let file = files[k];
    items.push(
      <Button
        key={`file-${k}`}
        onClick={() => {
          console.log(`Clicked ${file}`);
          props.archive.load(file);
        }}
      >
        {file}
      </Button>
    );
  }
  return (
    <div>
      <SectionHeader name="archive" />
      {items}
    </div>
  );
}

export { Browser };

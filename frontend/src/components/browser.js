import React from "react";
import Button from "@material-ui/core/Button";
import { SectionHeader } from "./section-header";
import { Archive } from "./archive";

import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";

function Browser(props) {
  const [list, setList] = React.useState([]);

  // Ogden "Og" Morrow
  const og = new Archive();
  og.onupdate = ({ type, payload }) => {
    if (type == "list") {
      var newList = [];
      for (let k = 0; k < payload.length; k++) {
        newList.push(
          <Button
            key={`list-${k}`}
            onClick={() => {
              console.log(`Loading ${payload[k]}`);
              og.load(payload[k]);
            }}
          >
            {payload[k]}
          </Button>
        );
      }
      setList(newList);
    } else if (type == "data") {
      console.log("received data");
      console.log(payload);
    }
  };

  if (list.length == 0) og.list("20130520-1900");

  return (
    <div>
      <SectionHeader name="archive" />
      {list}
    </div>
  );
}

export { Browser };

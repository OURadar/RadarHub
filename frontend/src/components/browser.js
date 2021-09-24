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
  og.onupdate = (array) => {
    var newList = [];
    for (let k = 0; k < array.length; k++) {
      newList.push(<Button key={`list-${k}`}>{array[k]}</Button>);
    }
    setList(newList);
  };

  if (list.length == 0) og.list("20130520-1930");

  return (
    <div>
      <SectionHeader name="archive" />
      {list}
    </div>
  );
}

export { Browser };

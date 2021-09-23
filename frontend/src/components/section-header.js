import React from "react";

import {
  Keyboard,
  Favorite,
  BrokenImage,
  TrackChanges,
  Storage,
} from "@material-ui/icons";

export function SectionHeader(props) {
  let icon;
  if (props.name == "control") {
    icon = <Keyboard style={{ color: "var(--gray)" }} />;
  } else if (props.name == "health") {
    icon = <Favorite style={{ color: "var(--red)" }} />;
  } else if (props.name == "scope") {
    icon = <BrokenImage style={{ color: "var(--blue)" }} />;
  } else if (props.name == "product") {
    icon = <TrackChanges style={{ color: "var(--green)" }} />;
  } else if (props.name == "archive") {
    icon = <Storage style={{ color: "var(--brown)" }} />;
  }
  return (
    <div className="sectionHeader">
      {icon}
      <div className="sectionTitle">{props.name}</div>
    </div>
  );
}

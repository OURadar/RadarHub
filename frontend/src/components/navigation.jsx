import React from "react";

import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";

import RadarIcon from "@mui/icons-material/Radar";
import EventNoteIcon from "@mui/icons-material/EventNote";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import GamepadIcon from "@mui/icons-material/Gamepad";

export function Navigation(props) {
  return (
    <BottomNavigation
      id="navbar"
      className="blur"
      value={props.value}
      onChange={props.onChange}
      showLabels
    >
      <BottomNavigationAction label="View" icon={<RadarIcon />} />
      <BottomNavigationAction label="Archive" icon={<EventNoteIcon />} />
    </BottomNavigation>
  );
}

Navigation.defaultProps = {
  value: 0,
  onChange: () => console.log("Navigation.onChange"),
};

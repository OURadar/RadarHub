import React from "react";

import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";

import RadarIcon from "@mui/icons-material/Radar";
import EventNoteIcon from "@mui/icons-material/EventNote";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import GamepadIcon from "@mui/icons-material/Gamepad";

export function Navigation({ value = 0, onChange = () => console.log("Navigation.onChange") }) {
  return (
    <BottomNavigation id="navbar" className="blur" value={value} onChange={onChange} showLabels>
      <BottomNavigationAction label="View" icon={<RadarIcon />} />
      <BottomNavigationAction label="Archive" icon={<EventNoteIcon />} />
    </BottomNavigation>
  );
}

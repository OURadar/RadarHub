import * as React from "react";

import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";

import RadarIcon from "@mui/icons-material/Radar";
import EventNoteIcon from "@mui/icons-material/EventNote";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import GamepadIcon from "@mui/icons-material/Gamepad";

import { colorDict, makeTheme } from "./theme";
import { TopBar } from "./topbar";
import { GLView } from "./glview";

export default function App(props) {
  const [value, setValue] = React.useState(0);
  const [view, setView] = React.useState(<div className="fullHeight"></div>);

  const glView = <GLView />;

  const listView = (
    <div className="fullHeight paper">
      <Box sx={{ pt: 15, bgColor: "var(--system-background)" }}>
        <div className="spacerTop">Something here</div>
      </Box>
    </div>
  );

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  React.useEffect(() => {
    console.log(`value = ${value}`);
    if (value == 0) {
      setView(glView);
    } else {
      setView(listView);
    }
  }, [value]);

  return (
    <div className="fullHeight">
      <TopBar />
      <Tabs
        value={value}
        onChange={handleChange}
        aria-label="icon tabs"
        className="fullWidth lightBackground"
        variant="fullWidth"
        sx={{ position: "fixed", top: 56, zIndex: 1 }}
      >
        <Tab icon={<RadarIcon />} aria-label="view" />
        <Tab icon={<EventNoteIcon />} aria-label="archive" />
        <Tab icon={<MonitorHeartIcon />} aria-label="health" />
        <Tab icon={<GamepadIcon />} aria-label="control" disabled />
      </Tabs>
      {view}
    </div>
  );
}

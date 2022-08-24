import React from "react";

import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";

export function removeSplash() {
  let o = document.getElementById("splash");
  if (o) o.style.opacity = 0;
  setTimeout(() => {
    document.getElementById("splash")?.remove();
    document.getElementById("app").classList.remove("hide");
  }, 500);
}

export function Splash(props) {
  const [value, setValue] = React.useState(0);
  const progress = props.progress;

  React.useEffect(() => {
    if (value <= 1) {
      setValue(progress);
    }
  }, [progress]);

  React.useEffect(() => {
    if (value === 1) {
      setTimeout(() => setValue(2), 300);
    } else if (value === 2) {
      setTimeout(() => setValue(3), 600);
    }
  }, [value]);

  if (value == 3) {
    return;
  }
  return (
    <div id="splash" className={value === 2 ? "hide" : undefined}>
      <svg
        id="splashLogo"
        version="1.1"
        viewBox="0 0 96 96"
        stroke="white"
        fill="none"
      >
        <g strokeWidth="6" fill="none">
          <circle cx="48" cy="48" r="25" />
          <circle cx="48" cy="84" r="9" />
          <circle cx="48" cy="84" r="9" transform="rotate(120,48,48)" />
          <circle cx="48" cy="84" r="9" transform="rotate(240,48,48)" />
        </g>
        <g strokeLinecap="round" strokeWidth="10">
          <path d="M48,5l0,15" />
          <path d="M48,5l0,15" transform="rotate(120,48,48)" />
          <path d="M48,5l0,15" transform="rotate(240,48,48)" />
        </g>
      </svg>
      <Box sx={{ width: "42%", margin: "40px auto", maxWidth: "300px" }}>
        <LinearProgress
          color="inherit"
          variant="determinate"
          value={props.progress * 100}
          sx={{ borderRadius: "2px" }}
        />
      </Box>
    </div>
  );
}

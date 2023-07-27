import React from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";

const link = "/static/docs/RadarHub One-Click User License 6-5-2023.pdf";

export function TermPage(props) {
  return (
    <Box id="agreement">
      <h1>Terms and Conditions</h1>
      <div className="spacer10"></div>
      <p>
        By clicking on Continue, you agree to the RadarHub's<span> </span>
        <a className="inline" href={link}>
          Terms and Conditions of Use
        </a>
        .
      </p>
      <div className="spacer10"></div>
      <Button variant="big" onClick={props.onClose}>
        Continue
      </Button>
    </Box>
  );
}

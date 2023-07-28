import React from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";

const link = "/static/docs/RadarHub One-Click User License.pdf";

export function TermPage(props) {
  React.useEffect(() => {
    document.getElementById("termCover").style.opacity = 1;
  }, []);

  return (
    <div id="termCover" className="cover">
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
    </div>
  );
}

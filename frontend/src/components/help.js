import React from "react";

import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";

export function HelpPage(props) {
  const style = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "900px",
    height: "76%",
    overflowY: "scroll",
    bgcolor: "var(--system-background)",
    textAlign: "center",
  };

  const theme = document.documentElement.getAttribute("theme") || "light";

  return (
    <Modal
      open={props.open}
      onClose={props.handleClose}
      aria-labelledby="modal-modal-title"
      aria-describedby="modal-modal-description"
    >
      <Box sx={style}>
        <div className="sheetContent">
          <div className="title">Overview</div>
        </div>

        <div
          dangerouslySetInnerHTML={{
            __html: `
          <video width="900" height="720" loop muted autoplay playsinline>
          <source src="/static/media/demo-0503-${theme}.mp4" type="video/mp4" />
          Video Help
          </video>
          `,
          }}
        />

        <div className="sheetContent">
          <div className="title">Navigation Shortcuts</div>

          <table className="keyTask">
            <tbody>
              <tr>
                <th>Keys / Gestures</th>
                <th>Tasks</th>
              </tr>
              <tr>
                <td>
                  <div className="key">z</div>
                </td>
                <td>Switch to Z - reflectivity</td>
              </tr>
              <tr>
                <td>
                  <div className="key">v</div>
                </td>
                <td>Switch to V - velocity</td>
              </tr>
              <tr>
                <td>
                  <div className="key">w</div>
                </td>
                <td>Switch to W - spectrum width</td>
              </tr>
              <tr>
                <td>
                  <div className="key">d</div>
                </td>
                <td>Switch to D - differential reflectivity</td>
              </tr>
              <tr>
                <td>
                  <div className="key">p</div>
                </td>
                <td>Switch to P - differential phase</td>
              </tr>
              <tr>
                <td>
                  <div className="key">r</div>
                </td>
                <td>Switch to R - cross-correlation coefficient</td>
              </tr>
              <tr>
                <td>
                  <div className="key">l</div>
                </td>
                <td>Toggle in between live / offline modes</td>
              </tr>
              <tr>
                <td>
                  <div className="key">shift</div> + motion
                </td>
                <td>Pan</td>
              </tr>
              <tr>
                <td>
                  <div className="key">option</div> + motion
                </td>
                <td>Tilt</td>
              </tr>
              <tr>
                <td>Scroll / Pinch</td>
                <td>Zoom</td>
              </tr>
              <tr>
                <td>Up / Down</td>
                <td>Navigate in scan sequence</td>
              </tr>
              <tr>
                <td>Left / Right</td>
                <td>Navigate along the same scan</td>
              </tr>
              <tr>
                <td>Double Click</td>
                <td>Reset the view</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="sheetContent">
          <div className="title">Data Request</div>
          <p>
            If you are interested in obtaining the original archive, please send
            us an email to: radar@arrc.ou.edu
          </p>
        </div>

        <div className="spacer25"></div>
      </Box>
    </Modal>
  );
}

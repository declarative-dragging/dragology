import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes } from "react-router-dom";
import { autoRoute } from "./autoRoute";
import { DemoPage } from "./demo/DemoPage";
import { PrettyValueView } from "./demo/PrettyValueView";
import { SingleDemoPage } from "./demo/SingleDemoPage";
import "./index.css";
import { IndexPage } from "./IndexPage";
import { NaturalNeighborTestPage } from "./NaturalNeighborTestPage";
import { RetroPage } from "./retro/RetroPage";
import { StudioPage } from "./studio/StudioPage";
import { SingleStudyPage } from "./study/SingleStudyPage";
import { StudyPage } from "./study/StudyPage";
import { ValueViewProvider } from "./ValueView";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ValueViewProvider component={PrettyValueView}>
      <HashRouter>
        {typeof __VITE_REACT_PROD__ !== "undefined" && (
          <div
            style={{
              position: "fixed",
              top: 4,
              left: 4,
              zIndex: 9999,
              background: "red",
              color: "white",
              padding: "2px 6px",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              pointerEvents: "none",
              opacity: 0.8,
            }}
          >
            REACT PROD
          </div>
        )}
        <Routes>
          {autoRoute("/", IndexPage)}
          {autoRoute("/study", StudyPage)}
          {autoRoute("/study/:id", SingleStudyPage)}
          {autoRoute("/demos", DemoPage)}
          {autoRoute("/demos/:id", SingleDemoPage)}
          {autoRoute("/natural-neighbor", NaturalNeighborTestPage)}
          {autoRoute("/studio", StudioPage)}
          {autoRoute("/studio/:filter", StudioPage)}
          {autoRoute("/retro", RetroPage)}
        </Routes>
      </HashRouter>
    </ValueViewProvider>
  </React.StrictMode>,
);

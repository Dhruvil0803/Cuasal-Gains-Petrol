import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AnalysisProvider } from "./context/AnalysisContext";
import { GraphProvider } from "./context/GraphContext";
import SupplyChainUpload from "./pages/SupplyChainUpload";
import SupplyChainExplorer from "./pages/SupplyChainExplorer";
import SupplyChainResults from "./pages/SupplyChainResults";
import ModelResult from "./pages/ModelResult";
import SupplyChainSimulate from "./pages/SupplyChainSimulate";

export default function App() {
  return (
    <BrowserRouter>
      <AnalysisProvider>
        <GraphProvider>
          <Routes>
            <Route path="/"                      element={<SupplyChainUpload />} />
            <Route path="/explore"               element={<SupplyChainExplorer />} />
            <Route path="/results"               element={<SupplyChainResults />} />
            <Route path="/model/:key"            element={<ModelResult />} />
            <Route path="/simulate"              element={<SupplyChainSimulate />} />
            <Route path="*"                      element={<Navigate to="/" replace />} />
          </Routes>
        </GraphProvider>
      </AnalysisProvider>
    </BrowserRouter>
  );
}

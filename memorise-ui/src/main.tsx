import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import { errorHandlingService } from "./infrastructure/services/ErrorHandlingService";
import "./index.css";

const handleBoundaryError = (error: Error, errorInfo: React.ErrorInfo) => {
  const appError = errorHandlingService.handleApiError(error, {
    layer: "boundary",
    boundary: "App",
    componentStack: errorInfo.componentStack,
  });
  errorHandlingService.logError(appError, {
    boundary: "App",
    componentStack: errorInfo.componentStack,
  });
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename="NPRG045">
      <ErrorBoundary onError={handleBoundaryError}>
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
);

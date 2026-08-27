import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ProfileProvider } from "./hooks/useProfile.js";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ProfileProvider>
          {/* Keep the shell behind a global fallback so one client-side crash
              does not take down router or auth state. */}
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </ProfileProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

import { Navigate, Route, Routes } from "react-router-dom";
import RequireGameSession from "./components/RequireGameSession";
import RequireResults from "./components/RequireResults";
import CreditsPage from "./pages/CreditsPage";
import GamePage from "./pages/GamePage";
import HomePage from "./pages/HomePage";
import NotFoundPage from "./pages/NotFoundPage";
import ProfilePage from "./pages/ProfilePage";
import ResultsPage from "./pages/ResultsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/game"
        element={
          <RequireGameSession>
            <GamePage />
          </RequireGameSession>
        }
      />
      <Route path="/profile" element={<ProfilePage />} />
      <Route
        path="/results"
        element={
          <RequireResults>
            <ResultsPage />
          </RequireResults>
        }
      />
      <Route path="/credits" element={<CreditsPage />} />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}

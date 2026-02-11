import { Navigate, Route, Routes } from "react-router-dom";
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
      <Route path="/game" element={<GamePage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/results" element={<ResultsPage />} />
      <Route path="/credits" element={<CreditsPage />} />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}

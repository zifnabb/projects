import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/shell/AppShell";
import { LoginPage } from "./features/auth/LoginPage";
import { RegisterPage } from "./features/auth/RegisterPage";
import { ResetPage } from "./features/auth/ResetPage";
import { RequireAuth } from "./features/auth/RequireAuth";
import { BuilderPage } from "./features/builder/BuilderPage";
import { HomePage } from "./features/home/HomePage";

export default function App() {
  return (
    <Routes>
      {/* Logged-out surfaces (Focused shell) */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/reset" element={<ResetPage />} />

      {/* Authenticated app (App shell: top bar + New Deck modal) */}
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/decks/:deckId" element={<BuilderPage />} />
          {/* /admin, /account slot in here */}
        </Route>
      </Route>
    </Routes>
  );
}

import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/shell/AppShell";
import { AccountPage } from "./features/account/AccountPage";
import { AdminPage } from "./features/admin/AdminPage";
import { LoginPage } from "./features/auth/LoginPage";
import { RegisterPage } from "./features/auth/RegisterPage";
import { ResetPage } from "./features/auth/ResetPage";
import { RequireAuth } from "./features/auth/RequireAuth";
import { BuilderPage } from "./features/builder/BuilderPage";
import { HomePage } from "./features/home/HomePage";
import { SharedDeckPage } from "./features/shared/SharedDeckPage";

export default function App() {
  return (
    <Routes>
      {/* Logged-out surfaces (Focused shell) */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/reset" element={<ResetPage />} />
      {/* public read-only share view (token-gated, PLAN §13) */}
      <Route path="/shared/:token" element={<SharedDeckPage />} />

      {/* Authenticated app (App shell: top bar + New Deck modal) */}
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/decks/:deckId" element={<BuilderPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

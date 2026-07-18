import { Route, Routes } from "react-router-dom";
import { LoginPage } from "./features/auth/LoginPage";
import { RegisterPage } from "./features/auth/RegisterPage";
import { ResetPage } from "./features/auth/ResetPage";
import { RequireAuth } from "./features/auth/RequireAuth";
import { HomePage } from "./features/home/HomePage";

export default function App() {
  return (
    <Routes>
      {/* Logged-out surfaces (Focused shell) */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/reset" element={<ResetPage />} />

      {/* Authenticated app */}
      <Route element={<RequireAuth />}>
        <Route path="/" element={<HomePage />} />
        {/* /decks/:id (builder), /admin, /account slot in here */}
      </Route>
    </Routes>
  );
}

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSession } from "./session";

/**
 * Route guard for authenticated surfaces. While the session query resolves we
 * render nothing (the pre-hydration theme script already painted the canvas, so
 * this is a blank canvas, not a flash). Logged-out users are redirected to
 * /login with the intended path preserved for post-login return.
 */
export function RequireAuth() {
  const { user, isLoading } = useSession();
  const location = useLocation();

  if (isLoading) return null;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

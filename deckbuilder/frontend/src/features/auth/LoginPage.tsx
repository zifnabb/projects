import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { useTheme } from "../../theme/ThemeProvider";
import type { CurrentUser } from "../../lib/types";
import { authApi } from "./api";
import { useSetSession } from "./session";
import { AuthLayout } from "./AuthLayout";
import styles from "./AuthLayout.module.css";

interface LocationState {
  from?: { pathname: string };
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useSetSession();
  const { setTheme } = useTheme();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const from = (location.state as LocationState | null)?.from?.pathname ?? "/";

  const mutation = useMutation({
    mutationFn: () => authApi.login(username, password),
    onSuccess: (user: CurrentUser) => {
      setSession(user);
      if (user.theme_pref) setTheme(user.theme_pref);
      navigate(from, { replace: true });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <AuthLayout title="Sign in">
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <TextField
          label="Username"
          autoComplete="username"
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {mutation.isError && (
          <p className={styles.formError} role="alert">
            {(mutation.error as Error).message}
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={mutation.isPending}
          disabled={!username || !password}
        >
          Sign in
        </Button>
      </form>
      <div className={styles.footer}>
        Have an invite?&nbsp;<Link to="/register">Register</Link>
      </div>
    </AuthLayout>
  );
}

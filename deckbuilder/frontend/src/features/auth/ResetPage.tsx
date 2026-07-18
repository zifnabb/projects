import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { useTheme } from "../../theme/ThemeProvider";
import type { CurrentUser } from "../../lib/types";
import { authApi } from "./api";
import { useSetSession } from "./session";
import { AuthLayout } from "./AuthLayout";
import styles from "./AuthLayout.module.css";

/** Admin-minted one-time reset link: /reset?token=<token> (PLAN §15). */
export function ResetPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const setSession = useSetSession();
  const { setTheme } = useTheme();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const mutation = useMutation({
    mutationFn: () => authApi.reset(token, password),
    onSuccess: (user: CurrentUser) => {
      setSession(user); // reset logs the user in on the fresh token version
      if (user.theme_pref) setTheme(user.theme_pref);
      navigate("/", { replace: true });
    },
  });

  if (!token) {
    return (
      <AuthLayout title="Reset password">
        <p className={styles.notice}>
          This reset link is missing its token. Ask an admin to mint a new one.
        </p>
        <div className={styles.footer}>
          <Link to="/login">Back to sign in</Link>
        </div>
      </AuthLayout>
    );
  }

  const passwordError =
    password.length > 0 && password.length < 8
      ? "At least 8 characters"
      : undefined;
  const confirmError =
    confirm.length > 0 && confirm !== password
      ? "Passwords don't match"
      : undefined;
  const canSubmit = !passwordError && !confirmError && password && confirm;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (canSubmit) mutation.mutate();
  }

  return (
    <AuthLayout title="Set a new password">
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={passwordError}
          hint={passwordError ? undefined : "At least 8 characters"}
          required
        />
        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={confirmError}
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
          disabled={!canSubmit}
        >
          Set password & sign in
        </Button>
      </form>
      <div className={styles.footer}>
        <Link to="/login">Back to sign in</Link>
      </div>
    </AuthLayout>
  );
}

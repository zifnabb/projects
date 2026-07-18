import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { useTheme } from "../../theme/ThemeProvider";
import type { CurrentUser } from "../../lib/types";
import { authApi } from "./api";
import { useSetSession } from "./session";
import { AuthLayout } from "./AuthLayout";
import styles from "./AuthLayout.module.css";

const USERNAME_RE = /^[A-Za-z0-9_.-]{3,32}$/;

export function RegisterPage() {
  const [params] = useSearchParams();
  const invite = params.get("invite") ?? "";
  const navigate = useNavigate();
  const setSession = useSetSession();
  const { setTheme } = useTheme();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  // Validate the invite before showing the form (friendly gate, PLAN §15).
  const inviteQuery = useQuery({
    queryKey: ["invite", invite],
    queryFn: () => authApi.checkInvite(invite),
    enabled: invite.length > 0,
    retry: false,
    staleTime: Infinity,
  });

  const mutation = useMutation({
    mutationFn: () =>
      authApi.register({
        invite,
        username,
        password,
        display_name: displayName || undefined,
      }),
    onSuccess: (user: CurrentUser) => {
      setSession(user);
      if (user.theme_pref) setTheme(user.theme_pref);
      navigate("/", { replace: true });
    },
  });

  const inviteValid = invite.length > 0 && inviteQuery.data?.valid === true;

  // No token, or a checked-and-invalid token → the friendly dead end.
  if (!invite || (inviteQuery.isFetched && !inviteQuery.data?.valid)) {
    return (
      <AuthLayout title="Register">
        <p className={styles.notice}>
          This invite is no longer valid. Registration is invite-only — ask an
          admin for a fresh invite link.
        </p>
        <div className={styles.footer}>
          <Link to="/login">Back to sign in</Link>
        </div>
      </AuthLayout>
    );
  }

  const usernameError =
    username.length > 0 && !USERNAME_RE.test(username)
      ? "3–32 chars: letters, numbers, _ . -"
      : undefined;
  const passwordError =
    password.length > 0 && password.length < 8
      ? "At least 8 characters"
      : undefined;
  const canSubmit =
    inviteValid && !usernameError && !passwordError && username && password;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (canSubmit) mutation.mutate();
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle={
        inviteQuery.data?.note ? `Invited: ${inviteQuery.data.note}` : undefined
      }
    >
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <TextField
          label="Username"
          autoComplete="username"
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          error={usernameError}
          required
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={passwordError}
          hint={passwordError ? undefined : "At least 8 characters"}
          required
        />
        <TextField
          label="Display name (optional)"
          autoComplete="nickname"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          hint="Defaults to your username"
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
          loading={mutation.isPending || inviteQuery.isLoading}
          disabled={!canSubmit}
        >
          Create account
        </Button>
      </form>
      <div className={styles.footer}>
        Already registered?&nbsp;<Link to="/login">Sign in</Link>
      </div>
    </AuthLayout>
  );
}

/**
 * Account settings (PLAN §15): display name · password (requires current) ·
 * theme (also on the top bar). Deliberately minimal.
 */
import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { api } from "../../lib/api";
import type { CurrentUser } from "../../lib/types";
import { useSession, useSetSession } from "../auth/session";
import styles from "./AccountPage.module.css";

export function AccountPage() {
  const { user } = useSession();
  const setSession = useSetSession();

  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [savedName, setSavedName] = useState(false);
  const nameMutation = useMutation({
    mutationFn: () =>
      api.patch<CurrentUser>("/api/auth/me", { display_name: displayName.trim() }),
    onSuccess: (u) => {
      setSession(u);
      setSavedName(true);
      setTimeout(() => setSavedName(false), 1500);
    },
  });

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savedPw, setSavedPw] = useState(false);
  const pwMutation = useMutation({
    mutationFn: () =>
      api.post<{ ok: boolean }>("/api/auth/change-password", {
        current_password: current,
        new_password: next,
      }),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirm("");
      setSavedPw(true);
      setTimeout(() => setSavedPw(false), 1500);
    },
  });

  function submitName(e: FormEvent) {
    e.preventDefault();
    if (displayName.trim()) nameMutation.mutate();
  }

  const pwError =
    next.length > 0 && next.length < 8
      ? "At least 8 characters"
      : confirm.length > 0 && confirm !== next
        ? "Passwords don't match"
        : undefined;

  function submitPassword(e: FormEvent) {
    e.preventDefault();
    if (current && next.length >= 8 && next === confirm) pwMutation.mutate();
  }

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Account</h2>
      <p className={styles.subtitle}>@{user?.username}</p>

      <form className={styles.card} onSubmit={submitName}>
        <h3 className={styles.cardTitle}>Display name</h3>
        <TextField
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          aria-label="Display name"
        />
        {nameMutation.isError && (
          <p className={styles.error}>{(nameMutation.error as Error).message}</p>
        )}
        <div>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={nameMutation.isPending}
            disabled={!displayName.trim() || displayName.trim() === user?.display_name}
          >
            {savedName ? "Saved ✓" : "Save"}
          </Button>
        </div>
      </form>

      <form className={styles.card} onSubmit={submitPassword}>
        <h3 className={styles.cardTitle}>Change password</h3>
        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          hint="At least 8 characters"
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={pwError}
        />
        {pwMutation.isError && (
          <p className={styles.error}>{(pwMutation.error as Error).message}</p>
        )}
        <div>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={pwMutation.isPending}
            disabled={!current || !next || !!pwError || next !== confirm}
          >
            {savedPw ? "Changed ✓" : "Change password"}
          </Button>
        </div>
      </form>
    </div>
  );
}

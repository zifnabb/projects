/**
 * Admin panel (PLAN §15 / DESIGN §8.8) — minimal, table-driven:
 * Invites (mint → copyable link, revoke) and Users (deactivate, reset link,
 * admin toggle; the never-zero-admins guard is server-side).
 */
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { api } from "../../lib/api";
import { timeAgo } from "../../lib/timeAgo";
import { useSession } from "../auth/session";
import styles from "./AdminPage.module.css";

interface InviteOut {
  code: string;
  note: string | null;
  created_at: string | null;
  expires_at: string | null;
  used_by: string | null;
  used_at: string | null;
  register_path: string;
}

interface AdminUser {
  id: string;
  username: string;
  display_name: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string | null;
  last_login_at: string | null;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}

export function AdminPage() {
  const { user: me } = useSession();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [resetLinks, setResetLinks] = useState<Record<string, string>>({});

  const invites = useQuery({
    queryKey: ["admin-invites"],
    queryFn: () => api.get<InviteOut[]>("/api/admin/invites"),
  });
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api.get<AdminUser[]>("/api/admin/users"),
  });

  const mint = useMutation({
    mutationFn: () =>
      api.post<InviteOut>("/api/admin/invites", { note: note.trim() || null }),
    onSuccess: () => {
      setNote("");
      qc.invalidateQueries({ queryKey: ["admin-invites"] });
    },
  });
  const revoke = useMutation({
    mutationFn: (code: string) => api.del(`/api/admin/invites/${code}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-invites"] }),
  });
  const setActive = useMutation({
    mutationFn: (args: { id: string; active: boolean }) =>
      api.post(`/api/admin/users/${args.id}/active`, { active: args.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
  const setAdmin = useMutation({
    mutationFn: (args: { id: string; is_admin: boolean }) =>
      api.post(`/api/admin/users/${args.id}/admin`, { is_admin: args.is_admin }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
  const mintReset = useMutation({
    mutationFn: (id: string) =>
      api.post<{ reset_path: string }>(`/api/admin/users/${id}/reset-link`),
    onSuccess: (data, id) =>
      setResetLinks((prev) => ({
        ...prev,
        [id]: `${window.location.origin}${data.reset_path}`,
      })),
  });

  const origin = window.location.origin;
  const pending = (invites.data ?? []).filter((i) => !i.used_by);
  const used = (invites.data ?? []).filter((i) => i.used_by);

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Admin</h2>

      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Invites</h3>
        <div className={styles.mintRow}>
          <TextField
            placeholder='Note — who is this for? (optional)'
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            variant="primary"
            size="md"
            loading={mint.isPending}
            onClick={() => mint.mutate()}
          >
            + Mint invite
          </Button>
        </div>
        {(setActive.isError || setAdmin.isError || revoke.isError) && (
          <p className={styles.error}>
            {((setActive.error ?? setAdmin.error ?? revoke.error) as Error)?.message}
          </p>
        )}
        {pending.length === 0 && <p className={styles.quiet}>No pending invites.</p>}
        {pending.map((i) => (
          <div key={i.code} className={styles.row}>
            <span className={styles.rowMain}>
              {i.note || "unlabelled"}{" "}
              <span className={styles.quiet}>· minted {timeAgo(i.created_at)}</span>
            </span>
            <CopyButton text={`${origin}${i.register_path}`} />
            <Button
              variant="danger"
              size="sm"
              onClick={() => revoke.mutate(i.code)}
            >
              Revoke
            </Button>
          </div>
        ))}
        {used.length > 0 && (
          <details>
            <summary className={styles.quiet}>{used.length} used</summary>
            {used.map((i) => (
              <div key={i.code} className={styles.row}>
                <span className={styles.rowMain}>
                  {i.note || "unlabelled"}{" "}
                  <span className={styles.quiet}>· used {timeAgo(i.used_at)}</span>
                </span>
              </div>
            ))}
          </details>
        )}
      </section>

      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Users</h3>
        {(users.data ?? []).map((u) => (
          <div key={u.id} className={styles.userBlock}>
            <div className={styles.row}>
              <span className={styles.rowMain}>
                <strong>{u.display_name}</strong>{" "}
                <span className={styles.quiet}>@{u.username}</span>
                {u.is_admin && <span className={styles.adminBadge}>admin</span>}
                {!u.is_active && <span className={styles.inactiveBadge}>deactivated</span>}
                <span className={styles.quiet}>
                  {" "}
                  · last login {timeAgo(u.last_login_at)}
                </span>
              </span>
              {u.id !== me?.id && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => mintReset.mutate(u.id)}
                    loading={mintReset.isPending && mintReset.variables === u.id}
                  >
                    Reset link
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAdmin.mutate({ id: u.id, is_admin: !u.is_admin })}
                  >
                    {u.is_admin ? "Demote" : "Make admin"}
                  </Button>
                  <Button
                    variant={u.is_active ? "danger" : "secondary"}
                    size="sm"
                    onClick={() => setActive.mutate({ id: u.id, active: !u.is_active })}
                  >
                    {u.is_active ? "Deactivate" : "Reactivate"}
                  </Button>
                </>
              )}
            </div>
            {resetLinks[u.id] && (
              <div className={styles.resetRow}>
                <code className={styles.resetLink}>{resetLinks[u.id]}</code>
                <CopyButton text={resetLinks[u.id]} />
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

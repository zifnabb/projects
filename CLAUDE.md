# projects/ — LavenderTown homelab

**This repo is a mirror and a doc set, not the deploy target.** The running system lives at
`/root/stacks/` on LavenderTown. Editing a compose file here changes nothing until it is
synced to the server and rebuilt.

Two skills carry the working context:

- **`/orient`** — run at the start of a session, or before touching the server. Loads the
  topology, access patterns, deploy playbook, and per-project status, and probes live state.
  `/orient deckbuilder` narrows to one project.
- **`/wrap`** — run at the end of a session. Reconciles docs with what changed, commits, and
  leaves the push to you.

Before acting on the server without running `/orient`, know these three things:

1. Restarting the whole `bigstackd` stack kills `cloudflared`, which kills **all** remote
   access **including SSH**. Restart `authentik-server authentik-worker` individually.
2. `docker stop` is intermittently blocked by snap-Docker AppArmor. Redeploys need the
   PID-kill sequence in `.claude/skills/orient/references/deploy.md`.
3. `/root/stacks/` needs `sudo`, and `cd` into it fails even with sudo — traversal happens
   pre-sudo. Use `sudo bash -c "cd /root/stacks/<stack> && ..."`.

Deeper context: [README.md](README.md) (port map, subdomains) · [AGENTS.md](AGENTS.md)
(conventions and accumulated lessons — the deep archive) · `stacks/*/README.md` (per-stack ops).

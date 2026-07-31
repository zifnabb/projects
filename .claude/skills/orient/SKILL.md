---
name: orient
description: Load working context for the LavenderTown homelab and the projects in this repo — server topology, access patterns, the deploy playbook, and per-project status — then probe live server state. Use at the start of a session, before acting on the server, or when the task involves stacks, containers, subdomains, ports, deckbuilder/vermilion, the dashboard, or the MCP server. An optional argument (deckbuilder | dashboard | mcp | stacks | testcases) narrows the deep-dive to one project.
---

# Orient — LavenderTown homelab

## 1. Mental model

**This repo is a mirror and a doc set. It is not the deploy target.** The running system is
`/root/stacks/` on LavenderTown; deploys are rsync/tar → Dockge → rebuild. Changing a compose
file here has zero effect until it is synced and rebuilt.

Three consequences:
- Never report something as "fixed" or "changed" on the strength of a local edit alone.
- Docs here drift from the server. When a fact matters, **probe** (§2) rather than trust.
- The server is the source of truth for state; this repo is the source of truth for *intent*.

## 2. Probe live state

Run this first for anything operational. Takes ~5s.

```bash
ssh -o BatchMode=yes -o ConnectTimeout=15 mrfuji@diglettscave.cooldad.top '
  hostname; uptime
  echo "--- containers ---"
  sudo docker ps -a --format "{{.Names}}\t{{.Status}}" | sort
  echo "--- stack dirs ---"
  sudo ls /root/stacks/
  echo "--- disks ---"
  df -h | grep -E "^/dev|mnt"
'
```

**Healthy baseline: 30 containers, all `Up`.** Anything `Exited`, or a count well under 30,
is the finding — see §5 for the two failure modes that produce it.

Public edge check (only if a subdomain is reported broken):

```bash
for h in vermilion celadon photos; do
  printf "%-14s " "$h"
  curl -s -o /dev/null -w "%{http_code}\n" --max-time 10 "https://$h.cooldad.top/"
done
```

`200`/`302` = healthy. **`530` (Cloudflare 1033) = `cloudflared` or `npm` is down, not the
internet.** Get in past the tunnel with `ssh -o ProxyCommand=none mrfuji@192.168.1.222`.

## 3. Hosts and access

| Host | Reach it with |
|---|---|
| **LavenderTown** (`192.168.1.222`) | `ssh mrfuji@diglettscave.cooldad.top` (Cloudflare Tunnel) |
| **terrenceb-dl** (`10.33.22.17`) | nested: `ssh mrfuji@diglettscave.cooldad.top "ssh terrenceb@10.33.22.17 '<cmd>'"` |

Three rules that cause most first-session failures:

1. `/root/stacks/` requires `sudo` for `mrfuji` (passwordless sudo is on).
2. **`cd /root/stacks/...` fails even under sudo** — traversal happens before sudo applies.
   Use `sudo bash -c "cd /root/stacks/<stack> && ..."`.
3. Always pass `-o BatchMode=yes -o ConnectTimeout=15` so a prompt can't hang the session.

Full transfer patterns, the double-hop rsync, and tunnel ports: **`references/access.md`**.

## 4. Topology

```
Internet → Cloudflare Tunnel (cloudflared, bigstackd) → NPM :80/:443 (infra)
             → service :port      [most protected by Authentik forward auth]
```

- Tunnel routes are configured in the **Cloudflare Zero Trust dashboard**, not in any local
  `config.yml`. Everything lands on NPM, which does the real routing by subdomain.
- NPM's SQLite DB (`/data/database.sqlite`) is the source of truth; it regenerates the nginx
  conf files on restart, so direct conf edits silently revert.
- NPM runs host-networked, so the `HTTP_PORT`/`HTTPS_PORT` env vars in its compose are ignored —
  it binds 80/81/443 regardless.

Eight stacks: `bigstackd` (Pi-hole, cloudflared, Vaultwarden, Authentik) · `infra` (NPM, Uptime
Kuma, Baikal) · `databases` (4× Postgres, 1× Redis) · `media` (Jellyfin, *arr, Immich, Invidious)
· `mailserver` · `lavender-dashboard` · `mcp` · `deckbuilder`.

**Do not duplicate the port map or subdomain table here** — they live in [README.md](../../../README.md)
and drift the moment there are two copies. Read them there when you need them.

## 5. Non-negotiables

- **Restarting the whole `bigstackd` stack takes down `cloudflared`, which takes down all
  remote access including SSH.** Restart `authentik-server authentik-worker` individually.
- **snap-Docker AppArmor intermittently blocks `docker stop`/`kill`/`compose down`** with
  "permission denied". The container keeps running. Redeploys need the PID-kill sequence in
  `references/deploy.md`. Never assume a stop succeeded — verify.
- **Snap docker auto-refresh is held** (`snap refresh --hold docker`). An auto-refresh on
  2026-07-25 force-stopped all 30 containers at once; `unless-stopped` did *not* bring them back
  because it looks like a manual stop. If you ever unhold and refresh, expect a full-fleet bounce
  and use the ordered recovery in `references/deploy.md` (databases → npm/cloudflared/dockge → rest).
- **Port 8888 is SnappyMail.** Before assigning any new port, check the live listeners and the
  NPM `proxy_host` table — not just the README.
- **Never commit `.env`.** Secrets live on the server only. `.env.example` files are the contract.
- Prefer `sudo` over changing ownership on root-owned paths.

## 6. Projects

Read the card for whatever the task touches; skip the rest. Full detail in **`references/projects.md`**.

| Project | Source | Stack dir | Port | Public at | State |
|---|---|---|---|---|---|
| **deckbuilder** ("vermilion") | [deckbuilder/](../../../deckbuilder/) | [stacks/deckbuilder/](../../../stacks/deckbuilder/) | 8099 (pg 5436) | `vermilion.cooldad.top` | LIVE, active development |
| **lavender-dashboard** | [lavender-dashboard/](../../../lavender-dashboard/) | [stacks/lavender-dashboard/](../../../stacks/lavender-dashboard/) | 7575 | `celadon.cooldad.top` | stable |
| **mcp-server** | [mcp-server/](../../../mcp-server/) | [stacks/mcp/](../../../stacks/mcp/) | 8765 | not exposed | stable, not wired to a client |
| **stacks/** | — | — | — | — | doc mirror of the server |

The **deckbuilder** is where nearly all recent work has happened, on branch `deckbuilder-build`
(48 commits ahead of `main`). Its canonical design + decision log is
[stacks/deckbuilder/PLAN.md](../../../stacks/deckbuilder/PLAN.md) **§2** — read that section before
any deckbuilder work; it carries the locked decisions, the shipped-phase record, and the current
backlog. Operational dev-loop and redeploy steps are in
[deckbuilder/README.md](../../../deckbuilder/README.md).

## 7. Which doc is canonical for what

| Need | Read |
|---|---|
| Port map, subdomain table, stack index | [README.md](../../../README.md) |
| Conventions, accumulated lessons, history | [AGENTS.md](../../../AGENTS.md) — deep archive, partly stale planning prose |
| How one stack works, its volumes and quirks | `stacks/<name>/README.md` |
| Deckbuilder design, decisions, status, backlog | [stacks/deckbuilder/PLAN.md](../../../stacks/deckbuilder/PLAN.md) §2 |
| Deckbuilder visual/UX system | [stacks/deckbuilder/DESIGN.md](../../../stacks/deckbuilder/DESIGN.md) |
| Deckbuilder dev loop + redeploy | [deckbuilder/README.md](../../../deckbuilder/README.md) |
| Non-obvious infra gotchas not in the repo | memory: `reference_lavendertown_infra.md` |

## 8. Verify, don't trust

Open items as of 2026-07-31. Delete an entry once it's genuinely resolved.

1. **MCP transport is ambiguous.** AGENTS.md's "PLAN: Expanding HTTP/SSH to the MCP Server" was
   never executed (now annotated as such), and its "Current State" list claims stdio-only with no
   HTTP endpoint — yet `:8765` has a live listener. No MCP client is configured against the server
   either. Check `sudo ss -tlnp | grep 8765` before asserting anything about how it's reachable.
2. **`cloudflared` is not Dockge-managed.** Its compose labels point at
   `/data/compose/2/docker-compose.yml` — a *Portainer* stack path left over from before the Dockge
   migration. All 29 other containers point at `/root/stacks/*`. The service *is* correctly defined
   in `/root/stacks/bigstackd/compose.yaml` with `TUNNEL_TOKEN` in that stack's `.env`, so
   recreating it is well-defined — but it drops the tunnel and your SSH with it, so it must be run
   detached. Command is in AGENTS.md → "TWO DOCKER DAEMONS". Until then, the one container carrying
   all external access is outside Dockge's control.
3. **Anything named `<hexid>_<name>`** is a half-finished AppArmor container swap. Rename it back:
   the dashboard joins subdomains to containers on exact name, so the link breaks silently.
   (Vaultwarden was in this state until 2026-07-31.)

**If `docker ps` can't see a container you know is running**, check the containerd layer:
`sudo ctr -n moby containers ls`. That is how a headless second daemon was found on 2026-07-31.
Note also that **`sudo` strips `DOCKER_HOST`** — `sudo DOCKER_HOST=... docker ps` silently queries
the default socket and returns confidently wrong answers. Use `sudo env DOCKER_HOST=unix://...`.

Two audits on 2026-07-31 cleared six items — dead `Test-cases/` mirror claims, the Satisfactory
deletion claim (then Satisfactory itself), the Vaultwarden container name, two tracked `.DS_Store`
files, and an undocumented Portainer on a second Docker daemon. Records are in AGENTS.md →
"Re-verification (2026-07-31)" and "TWO DOCKER DAEMONS".

## 9. Concurrent sessions

Another Claude session may be working the same repo and server at the same time (this has already
happened on deckbuilder). Before committing, check `git status` for changes you did not make, and
do not assume an unexpected container or a dirty file is drift — it may be someone else's work in
flight. Ask rather than clean up.

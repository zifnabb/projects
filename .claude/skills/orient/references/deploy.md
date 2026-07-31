# Deploy, redeploy, recover

## The custom-build pattern

Services built from source in this repo (`deckbuilder`, `lavender-dashboard`, `mcp-server`) all
follow the same shape:

1. Source lives in a **top-level dir** here (e.g. `deckbuilder/`).
2. A thin **`stacks/<name>/`** dir holds a reference `docker-compose.yml` + `README.md`.
3. The source tree is synced to **`/root/stacks/<name>/`** on the server, so `build: .` resolves.
4. Dockge points at `/root/stacks/<name>/docker-compose.yml` with **Build** enabled.

Compose inside the stack dir must use `build: .` — never a relative `../../` path.

## Redeploying a custom-build service

Two things bite, and both come from snap-packaged Docker:

- **`docker stop` / `kill` / `compose down` are intermittently blocked by AppArmor**
  (`cannot stop container: permission denied`). The container keeps running. This also breaks
  compose's own Recreate step, which then leaves the new container pre-created and *stopped*,
  named `<oldid>_<name>`.
- **An SSH-invoked foreground build dies if the tunnel drops** mid-build, which heavy builds
  seem to provoke. The build is killed with the session and the old container stays up — looking
  for all the world like a successful no-op deploy.

So: build detached, swap by hand, and verify by image ID.

```bash
# 1. sync the tree up (tar pipe — see references/access.md)

# 2. detached build; never foreground over SSH
sudo bash -c 'cd /root/stacks/<name> && \
  setsid nohup bash -c "docker compose up -d --build" > rebuild.log 2>&1 &'
#    poll rebuild.log until the build finishes

# 3. if Recreate failed ("cannot stop container"), swap manually
docker update --restart=no <name>
kill "$(docker inspect -f '{{.State.Pid}}' <name>)"     # wait for status exited
docker rm -f <name>
docker compose up -d                                     # starts the pre-created container
docker rename "$(docker ps -a --format '{{.Names}}' | grep '_<name>$')" <name>
docker update --restart=unless-stopped <name>

# 4. VERIFY — the running image must equal the image just built
docker inspect -f '{{.Image}}' <name>
docker images --no-trunc --format '{{.ID}}' <name>-<name>:latest
```

Step 4 is not optional. Every failure mode above ends with the *old* container still serving,
and nothing else distinguishes that from success.

**Leftover from a missed rename:** if a container shows up as `<hexid>_<name>`, the swap was never
completed. `docker rename` it back — the dashboard joins containers to subdomains on exact name,
so a mis-named container silently loses its link, and compose's `container_name:` no longer
matches what's running. Renaming is safe: no restart, uptime and health are preserved.
(Vaultwarden sat as `ef214b409b07_vaultwarden` for weeks before this was caught.)

## Exposing a new service publicly

Order matters; the tunnel is last.

1. **Pick a port.** Check live listeners (`sudo ss -tlnp`) *and* the NPM `proxy_host` table — the
   README port map is a record, not a lock. 8888 is SnappyMail.
2. **NPM proxy host**: `<sub>.cooldad.top` → `192.168.1.222:<port>`, via the admin UI on `:81`.
   Add Authentik forward auth unless the service has its own login (deckbuilder does; it has no
   Authentik).
3. **Cloudflare Tunnel route** in the Zero Trust dashboard — not in any local file. The service
   value must be **`http://localhost:80`** (plain HTTP into NPM). An `https://` scheme there
   yields `502 "not a TLS handshake"`.
4. **Update the docs in the same pass**: root README port map + subdomain table, and `SUBDOMAINS`
   in `lavender-dashboard/app/config.py` (then rebuild the dashboard). See `/wrap`.

### NPM's SQLite is the source of truth

The nginx conf files under `/data/nginx/proxy_host/<id>.conf` are **regenerated from
`/data/database.sqlite` on container restart** — direct conf edits silently revert. Neither the
host nor the npm container ships `sqlite3`; use a throwaway container:

```bash
docker run --rm --user 0 -v bkstacker_npm_data:/data keinos/sqlite3 \
  sqlite3 /data/database.sqlite "SELECT id, domain_names, forward_port FROM proxy_host;"
```

`proxy_host` uses soft deletes (`is_deleted=1, enabled=0`), not row deletes. Restart npm after
editing so the confs regenerate. DB and confs have been observed out of sync — when in doubt,
compare `forward_port` per id against `grep 'set $port' *.conf`.

## Recovery: the whole fleet is down

Symptom: every `*.cooldad.top` returns **530** / Cloudflare error 1033, and SSH via
`diglettscave` fails with `websocket: bad handshake`. The server is almost certainly fine.

```bash
ssh -o ProxyCommand=none mrfuji@192.168.1.222      # bypass the tunnel
sudo docker ps -a                                   # look for many Exited (128), same timestamp
snap changes                                        # "Auto-refresh snap 'docker'" at that time?
```

If so, restart in dependency order — a blanket `docker start` races the databases:

```bash
sudo docker start immich-postgres immich-redis authentik-postgres invidious-postgres deckbuilder-postgres
sleep 12
sudo docker start npm cloudflared dockge-dockge-1
sudo docker start $(sudo docker ps -aq --filter status=exited)
sudo docker restart authentik-server            # if unhealthy — it needs its Postgres up first
sudo docker ps -q | wc -l                       # expect 30
```

Snap refreshes for docker are **held** as of 2026-07-25 to prevent a recurrence. A deliberate
`sudo snap refresh docker` will bounce the fleet again — plan for this sequence afterwards.

## Restart safety

- **`bigstackd`**: never restart the stack. `cloudflared` lives there and carries all external
  access *including SSH* — bouncing it can lock you out mid-command. Target containers:
  `sudo docker restart authentik-server authentik-worker`.
- **Authentik outpost config** occasionally resets and starts redirecting to `localhost:9010`
  instead of the login page. Fix is two `UPDATE`s against `authentik-postgres` — SQL is in
  [stacks/bigstackd/README.md](../../../../stacks/bigstackd/README.md) — then restart server +
  worker only.
- **Stopping anything**: assume `docker stop` may fail silently. Verify with `docker ps`, and fall
  back to `kill "$(docker inspect -f '{{.State.Pid}}' <ctr>)"` then `docker rm -f`.

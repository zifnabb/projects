# Access patterns

Everything non-interactive. Always `-o BatchMode=yes` and a `ConnectTimeout` so a password or
host-key prompt can't hang the session.

## LavenderTown

```bash
ssh -o BatchMode=yes -o ConnectTimeout=15 mrfuji@diglettscave.cooldad.top '<cmd>'
```

Goes through the Cloudflare Tunnel. If it fails with `websocket: bad handshake`, the tunnel or
the server is down — fall back to the LAN and bypass the tunnel entirely:

```bash
ssh -o ProxyCommand=none mrfuji@192.168.1.222
```

### sudo rules

- `mrfuji` has passwordless sudo. `/root/stacks/` is unreadable without it.
- **`cd /root/stacks/<x>` fails even with sudo** — the shell resolves the path before sudo
  applies. Always:
  ```bash
  sudo bash -c "cd /root/stacks/<stack> && docker compose ..."
  ```
- Prefer sudo over `chown`-ing root-owned paths. (`deckbuilder/` and `lavender-dashboard/` under
  `/root/stacks/` are already owned by uid 501/staff from past rsyncs — an artifact, not a pattern
  to copy.)

### Writing files to the server

```bash
# single file
cat local-file | ssh mrfuji@diglettscave.cooldad.top 'sudo tee /root/stacks/<stack>/file' >/dev/null

# whole tree — tar over ssh, sudo on extract (reliable for root-owned targets)
tar czf - -C <local-dir> . | ssh mrfuji@diglettscave.cooldad.top \
  'sudo tar xzf - -C /root/stacks/<stack>/'

# rsync (only works where mrfuji can write; otherwise use the tar pipe)
rsync -av --delete <local-dir>/ mrfuji@diglettscave.cooldad.top:/root/stacks/<stack>/
```

## terrenceb-dl (internal test/dev box)

`10.33.22.17` on the ATL-NZ VPN subnet, user `terrenceb`. Only reachable nested through
LavenderTown:

```bash
ssh mrfuji@diglettscave.cooldad.top "ssh terrenceb@10.33.22.17 '<cmd>'"
```

Working area: `/media/terrenceb/mnt/testbox_home/copilot/Test-cases/` — TestLink/Jira/Zephyr test
case enrichment. Direct user access works there; no sudo needed. `secrets.md` in that tree holds
`JIRA_KEY` and `TESTLINK_DEVKEY` for the `tool/` scripts.

Pulling that tree to the Mac (double-hop):

```bash
# rsync — reliable for directories
rsync -av --delete \
  -e 'ssh -o BatchMode=yes mrfuji@diglettscave.cooldad.top ssh -o BatchMode=yes' \
  terrenceb@10.33.22.17:/media/terrenceb/mnt/testbox_home/copilot/Test-cases/ \
  ./Test-cases/

# tar pipe — fallback if rsync is finicky
ssh mrfuji@diglettscave.cooldad.top \
  "ssh terrenceb@10.33.22.17 'tar czf - -C /media/terrenceb/mnt/testbox_home/copilot/Test-cases .'" \
  | tar xzf - -C Test-cases/
```

Note: `Test-cases/` is currently **absent** from this repo despite the READMEs describing it as a
synced mirror. Confirm with the user before recreating it — the remote copy is authoritative
either way.

## Tunnels from the Mac

| Local port | Tunnels to | For |
|---|---|---|
| 8099 | `localhost:8099` on LavenderTown | deckbuilder dev loop — Vite proxies to the real API |
| 8765 | `localhost:8765` on LavenderTown | MCP server over HTTP |
| 3391 | `localhost:3389` on LavenderTown | RDP (xrdp/XFCE) |
| 3392 | `10.33.22.17:3389` via VPN | RDP to terrenceb-dl |

```bash
ssh -o ServerAliveInterval=30 -fN -L 8099:localhost:8099 mrfuji@diglettscave.cooldad.top
```

Raw RDP (3389) does **not** traverse the Cloudflare Tunnel — it needs the SSH tunnel above, or
direct LAN/VPN reachability.

## Deckbuilder API checks

A non-admin service account **`claude-qa`** exists for authenticated smoke tests against the live
site (login → scratch deck → exercise endpoints → delete it). Its password is on the server in
`/root/stacks/deckbuilder/.env` as `CLAUDE_QA_PASSWORD`. Admin identity is the username `zifnabb`.

For browser-based dev against the real backend, use Chrome or Firefox — the session cookie is
`Secure`, which Safari drops on plain-http localhost. **Dev writes hit the live database.**

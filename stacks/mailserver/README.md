# Mailserver Stack

Self-hosted email with webmail client for `cooldad.top`.

## Services

| Service | Image | Port | Subdomain | Auth |
|---------|-------|------|-----------|------|
| Docker Mailserver | `ghcr.io/docker-mailserver/docker-mailserver:latest` | 25, 143, 587, 993 | `mail.cooldad.top` (hostname) | — |
| SnappyMail | `djmaze/snappymail:latest` | 8888 | `webmail.cooldad.top` | — |

## Service Details

### Docker Mailserver

- **Hostname**: `mail.cooldad.top`
- **Network interface**: `enp6s0`
- **Postmaster**: `postmaster@cooldad.top`
- **Data**: `./docker-data/dms/` (relative bind mounts)
  - `mail-data/` — mailboxes
  - `mail-state/` — service state
  - `mail-logs/` — logs
  - `config/` — accounts, aliases, etc.

### SnappyMail (Webmail)

Browser-based email client.

- **Data**: `./docker-data/snappymail`

## Security Configuration

| Feature | Status |
|---------|--------|
| Rspamd (spam filter) | Enabled |
| IMAP | Enabled |
| OpenDKIM / OpenDMARC / SPF | Disabled |
| Amavis / SpamAssassin / ClamAV | Disabled |
| Fail2Ban | Disabled |
| SSL/TLS | Handled by Cloudflare tunnel / NPM |

## Notes

- Authentik sends auth emails via `localhost:25` through this mailserver
- SSL termination is handled externally — the mailserver itself has no TLS configured

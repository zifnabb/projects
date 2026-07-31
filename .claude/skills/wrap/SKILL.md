---
name: wrap
description: End-of-session close-out for the LavenderTown homelab repo — reconcile the docs with what actually changed, verify the server matches the repo, record durable lessons, and commit. Stops short of pushing and leaves the user a push reminder. Use when the user says they're done, wants to wrap up, or asks to tidy up and commit the session's work.
---

# Wrap — close out the session

Work through these in order. Skip a step only when it genuinely doesn't apply, and say so rather
than silently dropping it.

## 1. Establish what changed

```bash
git status -sb
git diff --stat
git diff --stat --cached
```

Then account for **server-side** changes too — files synced to `/root/stacks/`, containers
rebuilt, NPM proxy hosts, Cloudflare routes, config edited in a UI. Those leave no trace in
`git status` and are the most common thing to forget.

**Guard against concurrent sessions.** Another Claude session may be working this repo and server
at the same time. Before staging anything, check every modified file against what *you* touched.
If something changed that you didn't change, do not stage it and do not "clean it up" — mention
it to the user and leave it alone.

## 2. Reconcile the docs

For each change made this session, find the row and update every doc listed. The whole point of
this repo is that the docs stay true — a code change without its doc change is unfinished work.

| What changed | Update |
|---|---|
| **New service / stack** | Root [README.md](../../../README.md) stacks table + port map + subdomain table · new `stacks/<name>/README.md` · `STACKS` and `SUBDOMAINS` in `lavender-dashboard/app/config.py` (+ rebuild the dashboard) |
| **New or changed port** | Root README port map · `lavender-dashboard/app/config.py` · the stack's own README |
| **New or changed subdomain** | Root README subdomain table · `config.py` `SUBDOMAINS` (with the right `auth` flag) · confirm the NPM proxy host and Cloudflare route actually exist |
| **Service removed** | Root README "Legacy"/deprecated section · remove from `config.py` · annotate the stack README rather than deleting it (`stacks/lunamultiplayer/` is the pattern) |
| **Compose / volume / mount change** | That stack's `stacks/<name>/README.md` · the local `docker-compose.yml` mirror |
| **Deckbuilder feature or fix** | `stacks/deckbuilder/PLAN.md` **§2** (status, decision log, backlog) · `stacks/deckbuilder/README.md` build-progress table if a phase moved · `DESIGN.md` if the visual system changed |
| **Deckbuilder deploy** | PLAN §2 status line with the deployed image ID and what was verified live |
| **New gotcha, workaround, or hard-won lesson** | [AGENTS.md](../../../AGENTS.md) "General Lessons & Gotchas" — and consider a memory file (step 4) |
| **Access pattern, port, or infra quirk** | `.claude/skills/orient/references/access.md` or `deploy.md` |
| **Drift item in `/orient` §8 got fixed** | Delete that entry from `.claude/skills/orient/SKILL.md` |

Two habits that keep this cheap:

- **Don't duplicate a table.** If a fact already lives in the root README, link to it rather than
  restating it in a second doc.
- **Date any status claim.** "LIVE as of 2026-07-31" ages honestly; "currently live" doesn't.

## 3. Verify repo vs server

Only if something was deployed this session. A deploy that didn't take is the failure mode this
catches — see `.claude/skills/orient/references/deploy.md` for why it's easy to miss.

```bash
ssh -o BatchMode=yes -o ConnectTimeout=15 mrfuji@diglettscave.cooldad.top '
  sudo docker ps -a --format "{{.Names}}\t{{.Status}}" | sort
'
```

- 30 containers, all `Up`? Anything `Exited`, or named `<hexid>_<name>`, is unfinished business.
- For a rebuilt service, confirm the **running image ID matches the image just built** — the
  comparison command is in `deploy.md` step 4.
- If a public endpoint changed, curl it: `200`/`302` good, `530` means the tunnel or NPM is down.

State the result plainly. If a deploy is half-done, say so and fix it or flag it — don't let the
commit message imply it landed.

## 4. Record anything durable

Write a memory file only for things that will matter in a *future* session and aren't recoverable
from the repo or git history: a non-obvious infra quirk, a decision and its reasoning, a
correction to how the user wants things done. Update the existing file if one covers it —
`reference_lavendertown_infra.md` is the catch-all for server quirks — rather than adding a
near-duplicate. Skip this step entirely if nothing qualifies; most sessions don't.

## 5. Commit

Match the repo's established style:

- Subject: `<scope>: <lowercase imperative summary>` — e.g. `deckbuilder: fix duplicate-card
  legality`, `deckbuilder docs: reconcile status to LIVE`, `infra: bump NPM proxy for vermilion`.
  Docs-only changes get a `docs` suffix on the scope.
- Body: wrapped prose or a short bullet list explaining **why**, not just what. Note anything
  deployed vs not — `(not yet deployed)` in the subject is an established convention here and
  worth keeping.
- End with the standard `Co-Authored-By:` trailer for the current model.

Stage deliberately — `git add <paths>`, never `git add -A` — so a concurrent session's work and
stray `.DS_Store` files don't ride along. Check the branch first: feature work belongs on
`deckbuilder-build`, not `main`.

## 6. Stop. Don't push.

**Never `git push`.** Finish by telling the user:

- what was committed (subject lines), and on which branch
- anything deliberately left uncommitted, and why
- whether the server and the repo now agree
- **the push reminder**: the exact command, e.g.
  `git push origin deckbuilder-build`

Leave the push to them.

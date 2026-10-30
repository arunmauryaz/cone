# Agent instructions

## Start here

Read `README.md`, then `docs/development.md`. Read the guide for the layer you
will change: `docs/engine.md`, `docs/backend.md`, or `docs/frontend.md`.
Read `docs/market-modes.md` for recording/replay changes.
Read `docs/api.md` before changing any client/server contract. Current Windows
workspace: `D:\CONE`. The Desktop copy and `D:\CONE-archive` are references only.

## Architecture boundaries

- `backend/engine` is an independent Rust library. Keep its money/fill rules
  separate from host code. No HTTP, database, auth, broker SDK, system-clock reads,
  UI code, or absolute machine paths inside the library.
- Its manifest must remain usable after copying just that folder elsewhere.
  Do not introduce inherited workspace fields or dependencies outside it.
- `backend/src` hosts accounts, auth, database transactions, provider adapters,
  pending-order orchestration and schedules. Do not duplicate core fill math here.
- `frontend` is the current JavaScript/JSX React interface. Connected trading must
  use the server; do not enable browser execution when a server request fails.
- For a .NET/C++/TUI interface, prefer the existing HTTP/WebSocket service. Direct
  non-Rust library reuse needs an explicit binding; none currently exists.

## Preserve data and correctness

- Preserve `data/cone.sqlite3`, users, password changes and account IDs. Default
  data paths are relative to the process working directory. Launch the backend
  from the project root or explicitly set `CONE_DATABASE_PATH`.
- Bootstrap values come from ignored `data/local-setup.json` or environment.
  They apply only to an empty database. Never reintroduce a built-in password,
  reset-on-startup behavior, or a privileged special-case login.
- Persist account changes, executions, reservations and idempotency together.
- Use exact integer minor units for accounting; frontend numbers are display
  projections. Preserve quote freshness and account-scoped retry behavior.
- Real provider failure must not silently substitute simulated trade prices.
- Live charts read only this installation's recorded data. Never restore historical
  REST backfill or initial/stale provider snapshots into Live recording.
- Replay has a virtual clock, minute-level revelation and separate workspace_accounts.
  Do not let replay quotes/orders enter normal portfolios or expose future bars.
- Bot simulation and browser mock fallbacks were removed. Do not reintroduce them.
- Replay workspaces retain results until explicit deletion. Never reset practice
  books when creating/switching/extending another workspace. Migrate legacy replay
  files/accounts without losing money, positions or progress.
- Provider tokens are write-only local operator configuration, stored outside Git.
  Keep provider setup restricted to loopback binds. Preserve the shared stream,
  subscription cap and watchlist/position/order interests when changing data feeds.
- Preserve existing UI tokens, tabular numeric typography and JavaScript/JSX.
- Offer Day (`light`), Night (`pitch-black`) and Charcoal (`charcoal-dark`). Normalize old saved dark
  palettes through `frontend/src/utils/theme.js`; keep the shell flat, concise,
  responsive, with no scrolling ticker or decorative dashboard widgets.
- Keep build caches and temporary files on D: on this computer. Use
  `launcher.bat shell` or `. D:\Rust\env.ps1`; do not change global tool settings.

## Documentation is part of a behavior change

Update the relevant guides whenever behavior, setup, feature support, persistence,
API contracts or interface integration changes:

| Change | Update |
|---|---|
| Engine API, math, supported rules or standalone dependencies | `docs/engine.md` and `backend/engine/README.md` |
| Backend accounts, storage, feeds or scheduling | `docs/backend.md` |
| Routes, auth, payloads, errors or socket events | `docs/api.md` and affected clients |
| Web behavior or demo mode | `docs/frontend.md` |
| Layout, launch, prerequisites, deployment or verification | `README.md`, `docs/development.md`, and applicable verification notes |

Distinguish implemented features from plans. Do not claim full old-app parity,
live-provider validation or user-capacity benchmarks that have not been tested.

## Verification

From the project root:

```powershell
cargo fmt --manifest-path backend/Cargo.toml --all -- --check
cargo test --manifest-path backend/Cargo.toml --workspace --locked
cargo clippy --manifest-path backend/Cargo.toml --workspace --all-targets --locked -- -D warnings
cd frontend
npm run build
npm run lint
```

Run tests appropriate to the change. Test financial invariants and failure
rollback, not just response shape. For changed library boundaries, also test a
copy of `backend/engine` outside this workspace. On Windows, stop only the CONE
backend started for this task before rebuilding its running executable. Preserve
unrelated user processes. Verify the launcher after changing paths or layout.

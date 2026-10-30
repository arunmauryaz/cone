# CONE backend

The Rust service for the web terminal and future native/TUI clients. Trading math
stays in the independent [engine](engine/README.md) package.

See [architecture](../docs/backend.md), [API contract](../docs/api.md),
[development](../docs/development.md), and [engine reuse](../docs/engine.md).

From the project root:

```powershell
cargo run --manifest-path backend/Cargo.toml -p cone-backend --locked
```

Run from the project root to use the existing `data/cone.sqlite3` database. Set
`CONE_DATABASE_PATH` explicitly when running from another directory. The Rust
workspace and lockfile live here; the frontend is outside that workspace.

# Development, launch and deployment

## Working layout

The repository root contains backend/, frontend/, docs/, runtime data/ and the
launcher/overview/agent files. Rust's workspace root is **backend/**; its members
are the backend service and engine library. Cargo.lock is backend/Cargo.lock.
There is deliberately no second Rust workspace or launcher at the project root.
The Live catalogue is downloaded from Upstox. Static test-only quotes live under
backend/tests/fixtures; runtime storage is under root data/.

## Windows on this computer

- Project: D:\CONE.
- Rust toolchain, native GNU linker, caches and build artifacts: D:\Rust.
- Launch: D:\CONE\launcher.bat.
- Development shell: launcher.bat shell (or . D:\Rust\env.ps1 in PowerShell).
- Backend helper implementation: backend/scripts/launch.ps1.
- Runtime database: data/cone.sqlite3, with any SQLite WAL/SHM files.
- Initial local seed configuration: data/local-setup.json (ignored).
- Current launcher logs: data/logs/ (ignored).

No Rust installation is copied into the repository. The optional machine-specific
backend/.cargo/config.toml is ignored. D:\Rust\env.ps1 directs Cargo output to
D:\Rust\build\CONE and redirects temp/npm/pip/uv caches on this computer. Launch
IDEs from that shell to inherit the settings. This does not promise that Windows
or unrelated applications never write to C:.

The launcher stops existing listeners on ports 8000 and 5173, builds Rust, and
starts the backend with the project
root as working directory, waits for /health, installs frontend dependencies if
missing, and starts Vite on 127.0.0.1:5173. It stops only the backend process it
started when the frontend exits. Running the launcher again force-stops the
processes using those two development ports, including an unrelated listener if
one is using either port. A failure to stop a listener aborts startup.
Configured local seed values apply only to an empty
DB and never reset a renamed account or password.

## Other development machines

Install a suitable Rust toolchain and Node.js/npm. The declared core Rust minimum
is 1.85; the committed service lockfile and installed dependencies must also be
supported by the toolchain. The current setup is verified on installed stable
Rust. Windows native compilation needs a compatible linker; this machine uses a
portable GNU toolchain. Linux/macOS need their normal native C build tools for
bundled SQLite and the Rust target. Do not copy D:\Rust into Git.

From the project root, in two terminals:

```powershell
cargo run --manifest-path backend/Cargo.toml -p cone-backend --locked
```

```powershell
cd frontend
npm ci
npm run dev
```

Do not change the backend runtime working directory without explicitly setting
CONE_DATABASE_PATH: accidentally starting in backend/ with the default relative
path would create another database under backend/data/. The launcher avoids that.
Cargo's default output on other machines is backend/target, unless overridden
with CARGO_TARGET_DIR or --target-dir. Engine-only extraction is described in
[engine.md](engine.md).

## First user and credentials

Current local setup is data/local-setup.json with initialUsername and
initialPassword. It is ignored by Git. The launcher passes those as environment
inputs and enables the loopback-only CONE_LOCAL_ADMIN bootstrap. The backend
creates an ordinary first user only if the database has no users. There is no
admin role, special login bypass, fixed username or built-in default password.
Actual login checks database password hashes.

The local file is optional after provisioning; changing it does not alter existing
users. Keep actual credentials out of examples committed to Git. On a fresh clone
without seed inputs, the launcher starts without bootstrap; create an account
through registration. Manual setup can provide CONE_INITIAL_USERNAME,
CONE_INITIAL_PASSWORD and CONE_LOCAL_ADMIN=true on a loopback bind.

Settings > Account changes display name, username and password. Credential changes
verify currentPassword, keep the same account ID/portfolio, invalidate old sessions
and return a replacement token. New passwords use the normal minimum length;
initial bootstrap is separate. Never reset the default account during startup.

## Configuration

backend/.env.example and frontend/.env.example document the variables. Neither is
automatically loaded; set process environment variables in your shell or service.

| Variable | Meaning / default |
|---|---|
| CONE_BIND | API listener, 127.0.0.1:8000 |
| CONE_DATABASE_PATH | SQLite file, data/cone.sqlite3 relative to runtime cwd |
| CONE_ALLOWED_ORIGINS | Exact allowed browser origins, comma-separated |
| CONE_MARKET_PROVIDER | upstox (only supported provider) |
| CONE_INSTRUMENTS_FILE | Optional catalogue JSON with provider mappings |
| CONE_UPSTOX_ACCESS_TOKEN | Server-only provider token |
| CONE_WEB_DIR | Optional built frontend directory; unset in Vite development |
| CONE_LOCAL_ADMIN | Explicit loopback-only first-user bootstrap flag |
| CONE_INITIAL_USERNAME / CONE_INITIAL_PASSWORD | Empty-DB setup inputs only |
| VITE_API_URL / VITE_WS_URL | Public browser API/socket addresses |

For Upstox adapter behavior and mapping requirements, read backend.md. Do not put
broker tokens in VITE_* variables or user preference payloads.

For this local application, use Settings > Market Data to select Upstox and enter
an Analytics/access token; Save connection chooses Live or the selected Replay workspace.
The server stores write-only credentials in `data/market-provider.json` beside
the configured DB. That file and `upstox-instruments.json` are ignored by Git.
Saved provider settings override initial environment defaults. The public NSE/BSE
master downloads without a token; live quotes require one. Source switching does
not reset the account. Publicly bound deployments cannot use the local setup PUT;
their operator must provision server configuration privately. See backend.md for
streaming limits, subscription selection and catalogue/index membership sources.

## Verification

Stop only the CONE instance you launched before rebuilding a running Windows
executable. Then, from the project root:

```powershell
cargo fmt --manifest-path backend/Cargo.toml --all -- --check
cargo test --manifest-path backend/Cargo.toml --workspace --locked
cargo clippy --manifest-path backend/Cargo.toml --workspace --all-targets --locked -- -D warnings
cd frontend
npm run build
npm run lint
```

Engine portability check: copy backend/engine to a directory outside this
workspace and run cargo test against its manifest. Cargo generates an independent
lockfile there. Do not rewrite the copied manifest to make this check pass.

Browser checks should use a separate DB/ports, never modify the user's default
account for a test. Relevant flows include login, fills, pending cancellation,
reload/restart, credential edits/session rotation and lost-response order retries.
Keep screenshots and test caches outside the source tree. See verification.md for
the current evidence and limits; lint warnings are not proof of a failed build.

## Deployment and future clients

Build the service with:

```powershell
cargo build --manifest-path backend/Cargo.toml -p cone-backend --release --locked
```

Build React in frontend/ using npm ci and npm run build. Set its API/socket URLs
for the deployment at build time, then either serve frontend/dist with a web
server or set CONE_WEB_DIR=frontend/dist when the Rust process starts from the
project root. Serve HTTPS/WSS through the public reverse proxy and set exact
allowed origins. Keep the database in a persistent writable location outside
read-only installed application files.

Native clients can use the same running Rust service. They need no Vite or React
runtime. Windows launcher scripts are conveniences for this web project, not
requirements of the engine or service. There is currently no packaged .NET/C++
native library binding or multi-instance scheduler ownership design.

SQLite is the initial single-process baseline, not a proven thousand-user setup.
Do not add more independently writing in-memory account copies when scaling. Plan
shared durable transactions and scheduler ownership, then measure throughput.

## Data, backups and Git

Commit backend/frontend source, tests, docs, manifests and lockfiles. Ignore root
data/, target/, node_modules/, dist/, logs, secrets and machine Cargo config.
Back up SQLite using its online backup facilities or stop the service and copy the
database consistently with outstanding WAL/SHM files. Account, execution,
idempotency and reservation state must stay together.

Old code is outside the repository at D:\CONE-archive\old-project. Removed unused
frontend references are under D:\CONE-archive\unused-frontend. The original Desktop
copy remains untouched. These are references/backups, not runtime dependencies,
and not evidence that every legacy feature has been ported.

## Documentation maintenance

Follow the change-to-document map in ../AGENTS.md. API changes must update clients
and api.md; engine contract changes must update engine.md and the package README.
Document actual implementation and test evidence, including limitations, rather
than aspirational feature parity.


Market recording uses live-market.sqlite3 beside the configured account DB.
Replay adds replay_workspaces, workspace_accounts and app_meta to that DB.
Legacy single-replay files/accounts migrate once into a named workspace. Runtime
playback uses the SQLite workspace tables, not the old replay JSON files. Back up
the account DB, live-market.sqlite3 and private provider configuration together.
See [market modes](market-modes.md) for range loading and replay retention.

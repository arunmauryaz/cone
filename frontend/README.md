# CONE frontend

The current React 19/Vite interface. Node.js supplies development/build tools;
Rust owns authentication, trading and persistence.

From this folder: `npm ci`, then `npm run dev`. Start Rust separately or use
`../launcher.bat` on Windows to start both. See the [frontend guide](../docs/frontend.md)
and [development guide](../docs/development.md). Configuration examples are in
`.env.example`. Never place server credentials in browser environment variables.

# Testing Board

Run npm run typecheck, npm test and npm run build, followed by
cargo test --locked --manifest-path src-tauri/Cargo.toml.

Regression tests cover corrupted libraries, save failures, library round trips,
board-tree cycles, Home protection, reparenting and native asset deletion scope.

For manual Windows verification, run npm run tauri -- dev. Check creating and
nesting boards, importing files, typing then immediately closing, reopening,
search, dialogs, theme/scaling and custom window controls. Launching another
instance should focus the existing one. Keep backups of real libraries.

GitHub Actions repeats the automated checks and builds an NSIS installer.
Linux and macOS are not currently supported release targets.

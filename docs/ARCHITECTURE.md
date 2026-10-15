# Board architecture

Board is a Windows desktop app with a Tauri/Rust shell and Svelte frontend.
The domain model lives in src/lib/core/board.ts. The library service owns the
board tree and serializes changes through the storage repository. Home is the
root, journals contain blocks, and canvases contain freeform items.

Desktop storage uses tauri-plugin-store; browser previews use localStorage.
They are separate libraries. Existing journal-prefixed store keys and the
com.journal.app identifier are intentionally retained for compatibility.

Imported files live in the app's assets directory. Native deletion is confined
to that directory. Automatic pruning is disabled to avoid racing pending imports
and unsaved edits. Backups should include both the library and its assets.

The native close event waits for frontend persistence; failed saves leave the
window open with a retry action. A single-instance plugin prevents concurrent
windows from overwriting the same library.

Appearance and shared chrome derive from Cherry. Board always uses the compact
sidebar. Windows NSIS is the only supported release target at present.

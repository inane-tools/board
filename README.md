# Board

A Windows app for freeform boards and journals. Arrange notes, images, links,
files and nested boards on an infinite canvas, or write in a block editor.
Built with Tauri 2, Rust, Svelte 5, TypeScript and Tailwind 4.

Board shares its compact sidebar, dialogs, themes and window controls with
[Cherry](https://github.com/inane-tools/cherry).

![Board screenshot](https://inane.tools/board-screenshot.webp)

## Features

- Canvas boards with notes, tasks, media, links, colour swatches and child boards.
- Paste or drag direct image/GIF/video links to download media locally (up to 250 MB); failed imports remain links.
- Journals with headings, lists, tasks, quotes, callouts, code and images.
- Search across boards and their contents, shared colored tags, tag filters, and favourites.
- Light, dark and system themes, custom accents, tinted surfaces and app scaling.
- Local storage without accounts. Files are copied to Board's own assets folder.
- Copy notes and links as text, files through the Windows clipboard, or images using Copy image.
- Drag the export handle in an item header to copy it into another app or folder.
- Windows NSIS installer. Other operating systems are not currently supported.

Libraries are saved locally. Link previews and remote images/media use the network;
Board does not sync your notes to a server.

## Development on Windows

Install Node.js 22+, Rust, the Microsoft C++ build tools and WebView2.

```powershell
npm ci
npm run tauri -- dev
```

For a browser preview, run `npm run dev` and open
[localhost:1422](http://localhost:1422). Its library is separate from the desktop
library. Cherry can run alongside Board on its own port.

```powershell
npm run typecheck
npm test
npm run build
cargo test --locked --manifest-path src-tauri/Cargo.toml
npm run tauri -- build --bundles nsis
```

GitHub Actions builds and tests Windows, then uploads the NSIS installer as
`board-windows-x64`. No Linux or macOS installer is built.

## Your data

For compatibility with existing installations, Board retains its original
`com.journal.app` app identifier and `journal-library-v3.json` storage filename.
On Windows they live under `%APPDATA%\com.journal.app`. Back up that entire
folder, including `assets`, with Board closed.

Board reports save failures and waits for pending edits before closing. If a
library cannot be read or is structurally damaged, Board leaves it untouched
and shows an error. Unreferenced imported files are retained rather than being
automatically deleted during editing.

## Project layout

- `src/lib/core`: domain models.
- `src/lib/infra`: persistence.
- `src/lib/app`: state and services.
- `src/lib/ui`: shared components, chrome and views.
- `src-tauri/src`: desktop shell, file storage and link previews.

## License

[MIT](LICENSE)

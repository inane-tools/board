# Changelog

## 1.0.0 — unreleased

- Pasted, dragged, and manually added direct image/GIF/video URLs download into local media items, with link fallback when imports fail.

- Added shared colored tags with a titlebar editor, global rename/delete, and item-header chips.
- Added native Windows file copying, Copy image, and drag-out handles; notes and links copy as readable text.
- Made full item headers appear on hover or focus, and added the titlebar fade.
- Fixed canvas/grid and default card colors in light mode.
- Made tinted surfaces control the canvas tint, made the settings header scroll, and added Board open-source credits.

- Initial Board app: canvas boards, block journals, nested boards, search and favourites.
- Migrated development to the Board repository; Windows is the supported platform.
- Added explicit save-error reporting, corruption protection and save-before-close handling.
- Prevented deleting Home and moving a board into itself or its descendants.
- Stopped automatic asset deletion during editing and restricted native file deletion to app assets.
- Prevented canvas shortcuts from changing content behind dialogs; preserved import destinations across navigation.
- Aligned appearance controls with Cherry and corrected Board's repository links.
- Removed unused Cherry keychain commands and Linux release packaging.
- Added regression tests and updated vulnerable transitive frontend dependencies.

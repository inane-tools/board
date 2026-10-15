# Changelog

## 1.0.0 — unreleased

- Initial Board app: canvas boards, block journals, nested boards, search and favourites.
- Migrated development to the Board repository; Windows is the supported platform.
- Added explicit save-error reporting, corruption protection and save-before-close handling.
- Prevented deleting Home and moving a board into itself or its descendants.
- Stopped automatic asset deletion during editing and restricted native file deletion to app assets.
- Prevented canvas shortcuts from changing content behind dialogs; preserved import destinations across navigation.
- Aligned appearance controls with Cherry and corrected Board's repository links.
- Removed unused Cherry keychain commands and Linux release packaging.
- Added regression tests and updated vulnerable transitive frontend dependencies.

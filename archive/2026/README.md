# Archive — 2026 Data Snapshots

This directory contains data and source snapshots captured during 2026 development.

## Contents

### `char_detail.json.backup`

A backup of the character detail dataset taken prior to a data migration. It is **not identical** to the active dataset at `public/data/char_detail.json` and should not be deleted without confirming the active dataset is complete.

- Safe to delete once the active dataset has been verified and no rollback is needed.
- Do not regenerate from this file without reviewing the diff against the current active data.

### `src/`

Source snapshots taken at a point-in-time during refactoring. These are retained for reference and are not part of the application build.

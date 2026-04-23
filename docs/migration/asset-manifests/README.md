# Asset Manifesting

This folder stores machine-readable manifests produced during controlled crawls.

## Files
- `asset-manifest.csv`: canonical manifest for discovered assets.
- `asset-manifest-notes.md`: unresolved assets, restrictions, and TODO items.

## Required fields
- source_url
- source_page
- asset_type
- mime_type
- checksum_sha256
- first_seen_utc
- last_seen_utc
- local_stage_path
- local_curated_path
- status
- notes

## Status values
- discovered
- downloaded
- deduped
- curated
- unresolved
- restricted

## Policy reminders
- Default allow same-origin assets.
- Optional allowlist for approved CDN domains.
- Never overwrite curated assets without explicit approval.

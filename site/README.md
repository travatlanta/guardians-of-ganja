# Guardians of Ganja Static Rebuild (Phase 1)

## Included Pages
- Home: /
- Services Hub: /services
- Service Details: /services/liability, /services/property, /services/commercial-auto, /services/products-completed-ops, /services/work-comp, /services/crop
- Contact: /contact
- Gallery: /gallery
- Privacy: /privacy
- Terms: /terms
- Login: /login
- Dashboard: /dashboard
- Admin: /admin

## Localized Source Inputs
- Raw downloaded assets: ../public/imports/guardians-of-ganja/raw
- Curated deduped images: ../public/assets/guardians-of-ganja/images
- Site mirror of curated images: assets/img/curated
- Source content snapshots: ../docs/migration/content-snapshots/raw-html and ../docs/migration/content-snapshots/text

## Rebuild Scripts
- Crawl/discovery: ../scripts/crawl-assets.ps1
- Full acquisition: ../scripts/acquire-assets-and-content.ps1
- Curated asset pack builder: ../scripts/build-curated-asset-pack.ps1

## Quick Preview
Run a local static server from this folder and browse extensionless paths.

Example (PowerShell):

```powershell
Set-Location "c:\Dev\Guardians of Ganja\site"
python -m http.server 5500
```

Then browse to `http://localhost:5500`.

Notes:
- Public links are extensionless.

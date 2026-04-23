# Guardians of Ganja Static Rebuild (Phase 1)

## Included Pages
- Home: index.html
- Services: services.html
- Contact: contact.html
- Gallery: gallery.html
- Privacy: privacy.html
- Terms: terms.html

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
Open `index.html` directly, or run a local static server from this folder.

Example (PowerShell):

```powershell
Set-Location "c:\Dev\Guardians of Ganja\site"
python -m http.server 5500
```

Then browse to `http://localhost:5500`.

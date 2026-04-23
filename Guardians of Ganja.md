# Guardians of Ganja - Rebuild Project Specification

Project Name: Guardians of Ganja Rebuild
Domain: https://www.guardiansofganja.com
Project Type: Existing Site Rebuild
Project Root: C:\Dev\Guardians of Ganja

## 1. Executive Snapshot

### Business Context
- Guardians of Ganja is a specialty cannabis insurance provider.
- Primary target segments: dispensaries, cultivators, manufacturers.
- Current site is brochure-style with services, gallery, and contact funnel.

### Primary Rebuild Objectives
- Preserve and sharpen trust-focused positioning and sales messaging.
- Rebuild into Engine8 standards for performance, maintainability, and SEO.
- Acquire and normalize all core media/content assets into project-controlled storage.
- Prepare clean handoff for GitHub, Vercel, and Neon after completion.

## 2. Source Site Discovery

### Public IA (Observed)
- Home
- Services
- Gallery
- Contact

### Content Signals
- Homepage headline emphasizes specialty cannabis insurance.
- Services page includes coverage categories:
  - Liability
  - Products and Completed Operations
  - Property
  - Work Comp
  - Commercial Auto
  - Crop
- Contact page includes quote CTA and required contact form fields.
- Gallery relies heavily on third-party CDN-hosted media assets.

### Platform/Technical Hints
- Asset URL patterns indicate hosted builder/CDN media structure.
- Rebuild must treat source media ingestion as a first-class migration task.

## 3. Scope

### In Scope
- Full rebuild of current public site pages and core user journeys.
- Content migration and cleanup.
- Asset crawl, acquisition, dedupe, and cataloging.
- SEO baseline and accessibility baseline implementation.
- Provisioning ledger and handoff runbook (GitHub, Vercel, Neon).

### Out of Scope
- Insurance policy administration software.
- Advanced quoting engine backoffice logic.
- Paid ads campaign management.

## 4. Page and Template Plan

### Target Pages
1. Home
2. Services Overview
3. Service Detail Template
4. Gallery
5. Contact
6. Policy pages (Privacy/Terms) if missing

### Template Decisions
- Reusable service cards and detail content blocks.
- Gallery with optimized loading and clean taxonomy.
- Contact conversion block with validation and anti-spam controls.
- Trust components for direct-contact and niche expertise signals.

## 5. Content Migration Map

### Source Inputs
- Existing live page copy.
- Existing service headings and descriptions.
- Existing CTA language and contact details.
- Existing gallery labels and media references.

### Migration Rules
- Keep voice and business intent intact.
- Improve hierarchy, readability, and conversion clarity.
- Remove repeated boilerplate and duplicated structural fragments.
- Preserve compliance-safe language for insurance context.

### Content QA
- Exactly one H1 per page.
- Logical heading hierarchy.
- Unique title/meta description per page.
- All key CTAs and contact data verified.
- Alt text for all production media assets.

## 6. Asset Acquisition and Normalization

### Required Acquisition Workflow
1. Run controlled crawl (homepage + internal links + sitemap discovery where available).
2. Extract all content/media references into a manifest.
3. Download allowed assets into staged import folder.
4. Record source URL, mime type, checksum, first-seen, last-seen.
5. Deduplicate by checksum before promotion to curated production assets.
6. Mark unresolved or restricted assets as TODO.

### Staging Structure
- raw imports: /public/imports/guardians-of-ganja/raw
- curated assets: /public/assets/guardians-of-ganja
- manifests: /docs/migration/asset-manifests

### Acquisition Policies
- Default allow: same-origin assets.
- Optional allowlist: approved CDN domains.
- Skip blocked/unauthorized resources.
- Never overwrite curated assets without explicit approval.

### Ownership Gate
- Full content/media acquisition requires explicit owner confirmation before execution.

## 7. SEO and Technical Baseline

### Required Baseline
- Metadata completeness across indexable pages.
- Canonicals, Open Graph, robots, sitemap.
- Semantic HTML landmarks and keyboard-friendly interaction.
- Responsive image handling and performance-safe asset loading.

### Performance Targets
- Fast mobile rendering.
- Minimized layout shift.
- Reduced third-party script bloat.

## 8. Provisioning Ledger (Engine8-Owned First)

### Provisioning Standard
Engine8 provisions initially, then transfers cleanly at handoff.

### Minimum Provisioned Assets
1. GitHub repository
2. Vercel project
3. Neon database
4. Domain/DNS state entries
5. Credential inventory

### Required Ledger Fields
- Asset type
- Current owner
- Created by
- Transfer status
- Transfer timestamp
- Notes / rollback reference

### Transfer States
- pending
- in_progress
- transferred
- failed

## 9. Handoff Runbook (GitHub, Vercel, Neon)

### Preflight
1. Verify client account access and roles.
2. Verify integration connections and permissions.
3. Confirm env var inventory and secret parity.
4. Confirm rollback path and backup checkpoints.

### GitHub Handoff
1. Transfer repository ownership.
2. Validate repo access and branch protection.
3. Validate CI secrets and deployment references.
4. Log completion evidence.

### Vercel Handoff
1. Transfer project/team ownership.
2. Reconcile environment variables.
3. Verify deployment health in production.
4. Verify domain and SSL state.

### Neon Handoff
1. Choose handoff path (direct transfer if available, else migration cutover).
2. Execute migration/export-import as required.
3. Rotate credentials and update connection vars.
4. Validate read/write and app connectivity.
5. Log post-cutover evidence.

### Post-Transfer Smoke Test
- Live site reachable and stable.
- Forms and key conversion paths operational.
- DB connectivity healthy.
- Domain resolution and SSL valid.
- Client confirms access to all transferred assets.

## 10. Risks and Mitigations

- Risk: Missing or low-quality source media.
  - Mitigation: Manifest-driven gap audit and replacement queue.
- Risk: Copy drift during migration.
  - Mitigation: Locked source-to-target mapping with QA review.
- Risk: Transfer failures during handoff.
  - Mitigation: Dry-run orchestration and rollback notes per asset.
- Risk: Neon cutover complexity.
  - Mitigation: Documented migration playbook and post-cutover checks.

## 11. Acceptance Criteria

The project is ready to build and execute when:
1. Core page map and content migration map are approved.
2. Asset acquisition plan is approved and ownership-gated.
3. Provisioning ledger template is in place.
4. Handoff runbook is complete for GitHub, Vercel, and Neon.
5. Open TODO items are explicit and assigned.

The project is ready for final handoff when:
1. All required transfers are complete or validated with agreed migration path.
2. Post-transfer smoke tests pass.
3. Client has confirmed account-level ownership/access.
4. Final checklist and evidence log are complete.

## 12. Open Decisions

1. Keep current visual identity as-is or include partial refresh.
2. Gallery strategy: full migration vs curated highlights.
3. Contact routing destination(s): email only vs CRM integration.

## 13. Build Kickoff Checklist

1. Use this markdown as source of truth.
2. Run first crawl and generate acquisition manifest.
3. Lock content map and page skeleton.
4. Initialize project infrastructure records.
5. Begin implementation sequence: Home -> Services -> Contact -> Gallery.

## 14. Workflow Standard (All Future Projects)

Every new rebuild project markdown must include:
1. Discovery snapshot.
2. Crawl/acquisition manifest summary.
3. Content migration map.
4. Provisioning ledger (GitHub/Vercel/Neon).
5. Handoff runbook.
6. Acceptance checklist.

If required data is missing, add explicit TODO lines instead of removing sections.

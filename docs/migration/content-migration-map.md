# Content Migration Map

## Rules
- Keep business intent and voice intact.
- Improve hierarchy and readability.
- Remove repeated boilerplate and duplicated structure.
- Preserve compliance-safe insurance language.

## Page Mapping

### Home
- Source URL: https://www.guardiansofganja.com/
- Target template: home
- H1: Specialty Cannabis Insurance (confirm exact source H1 during copy pass)
- Primary CTA: Get a Quote
- Required blocks: trust intro, segment positioning, featured coverages, contact conversion block
- Notes: Preserve trust-first insurance positioning and tighten conversion clarity.

### Services Overview
- Source URL: https://www.guardiansofganja.com/services
- Target template: services-overview
- H1: Services
- Service cards:
	- Liability
	- Products and Completed Operations
	- Property
	- Work Comp
	- Commercial Auto
	- Crop
- Notes: Build reusable card component to feed service detail template.

### Service Detail Template
- Service slug: liability
- Source URL: https://www.guardiansofganja.com/services
- H1: Liability Coverage
- Coverage summary: TODO
- CTA: Get a Quote
- Notes: Repeat for all six coverage categories.

### Gallery
- Source URL: https://www.guardiansofganja.com/gallery
- Target template: gallery
- H1: Gallery
- Taxonomy strategy: by business segment + media type
- Notes: Optimize image delivery and preserve strongest proof-oriented visuals.

### Contact
- Source URL: https://www.guardiansofganja.com/contact
- Target template: contact
- H1: Contact
- Form fields: name, email, phone, business details, message (confirm exact list during form audit)
- Routing destination: TODO (email-only vs CRM)
- Anti-spam control: honeypot + server-side validation
- Notes: Keep low-friction quote CTA and required fields from current form.

### Policy Pages (Privacy/Terms)
- Present on source: TODO
- Required action: add template and publish if missing
- Notes: Ensure legal links are present in footer and crawlable.

## QA Checklist
- Exactly one H1 per page
- Logical heading hierarchy
- Unique title and meta description per page
- All key CTAs verified
- Contact data verified
- Alt text assigned for production media

# Handoff Runbook (GitHub, Vercel, Neon)

## Preflight
1. Verify client account access and roles.
2. Verify integration connections and permissions.
3. Confirm env var inventory and secret parity.
4. Confirm rollback path and backup checkpoints.

## GitHub Handoff
1. Transfer repository ownership.
2. Validate repo access and branch protection.
3. Validate CI secrets and deployment references.
4. Log completion evidence.

## Vercel Handoff
1. Transfer project/team ownership.
2. Reconcile environment variables.
3. Verify deployment health in production.
4. Verify domain and SSL state.

## Neon Handoff
1. Choose handoff path (direct transfer if available, else migration cutover).
2. Execute migration/export-import as required.
3. Rotate credentials and update connection vars.
4. Validate read/write and app connectivity.
5. Log post-cutover evidence.

## Post-Transfer Smoke Test
- Live site reachable and stable.
- Forms and key conversion paths operational.
- DB connectivity healthy.
- Domain resolution and SSL valid.
- Client confirms access to all transferred assets.

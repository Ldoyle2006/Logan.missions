# Security and database maintenance — October 23, 2026 (Hawaii)

## Node.js security update prepared

The official October 21 Node.js advisory includes a Brotli decoder memory-corruption vulnerability and other fixes. Node.js 24.22.1 is a patched release on the existing local 24.x line.

- Local default `node --version` was v24.21.0 when inspected.
- Downloaded the official Windows x64 v24.22.1 executable into the ignored `.local/node-v24.22.1-win-x64/` directory. Its SHA-256 matched the official release checksum.
- All 55 existing tests passed under that verified executable, including HTTP security and PostgreSQL persistence tests.
- Added `.node-version` selecting 24.22.1 and bounded the package/lockfile engine requirement to `>=24.22.1 <25`.
- The owner approved deploying the security update on October 23, 2026. Verify production's selected Node version and release status after deployment; approval or a successful push alone does not prove the running service was patched.
- A Render `NODE_VERSION` setting overrides the repository version file. Check its value, redeploy, and verify the actual selected version in deployment logs. Do not assume a source change alone patched a running service.
- Authenticated `GET /api/school-admin/runtime` reports only the running Node version and Render commit ID. It requires the existing admin session, stays available independently of database connectivity, and is marked no-store/noindex. The HTTP integration test covers unauthenticated rejection and authenticated access. This allows release verification when dashboard access is unavailable without exposing runtime diagnostics to public visitors.
- The normal local Node installation remains v24.21.0; the project-private patched executable was used for this work. Update the normal development runtime too before returning to ordinary `npm start` use.

The notice's version information matches an official advisory. This does not authenticate the pasted email or establish that this website was exploited. Production runtime history, Render access/runtime logs, Stripe request logs, charges, payouts and account settings have not been reviewed in this maintenance pass. No keys have been rotated. Patch/redeploy and review activity, then coordinate key rotation with the owner; keep secret values out of public files and chat. Review other credentials if evidence establishes a server compromise. Do not describe a redeploy alone as a completed incident investigation.

Official sources:

- https://nodejs.org/en/blog/vulnerability/october-2026-security-releases
- https://render.com/docs/node-version
- https://docs.stripe.com/keys-best-practices

## School ledger database expiry

The owner's latest Render notice states that `logan-school-test` (`dpg-db82ofpsrm7s738g960g-a`) will become inaccessible on November 14, 2026 unless upgraded. The exact suspension time/timezone must be checked in Render; do not assume the entire local November 14 is available. Despite its test-oriented name, this database stores both live and test school fundraising ledgers.

Render documents free database expiry after 30 days, followed by a 14-day upgrade grace period and deletion. The grace period does not preserve normal application access. Losing database access would interrupt database-dependent school checkout/tracking and administration; it would not itself delete Stripe's payment records.

Using the patched runtime and the existing saved external connection, a read-only snapshot was taken and validated. It contains both live and test ledger rows in the existing `logan-school-ledger-v1` format. The snapshot is private in ignored `.local/ledger-backups/`, timestamped `2026-10-24T07-40-04-560Z` (October 23 in Hawaii). No donor data was printed or added to source control.

This is an application-ledger JSON snapshot, not a full PostgreSQL `pg_dump`, a forensic disk image, or a managed recovery backup. A full database export and/or verified migration remains a separate task. The database plan remains free, honoring the owner's previous decision to defer paid upgrades until closer to expiry. A paid upgrade needs approval of its actual recurring price; migration requires a selected destination and verification before disconnecting the current database.

Official sources:

- https://render.com/docs/free#free-postgres
- https://render.com/docs/postgresql-backups#exporting-with-pg-dump

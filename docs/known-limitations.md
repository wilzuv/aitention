# Known limitations and release checks

## Deliberately deferred

- Recurring completion writes a completion record and reschedules the task in separate operations. Browser and MCP paths duplicate some rules and choose local/UTC dates differently. A shared transactional database operation is the next substantive reliability improvement.
- MCP bearer tokens have no expiry or read-only scope. Stytch JWT validation enforces the MCP resource audience, but does not provide per-tool scopes. Connected Apps, including dynamically registered clients, must be configured to issue that audience; otherwise OAuth requests are rejected. Use trusted clients; review authorization before offering a broad hosted service.
- Some hooks call Supabase directly instead of going through services. This is architectural inconsistency, not a reason for a framework rewrite before first release.
- Relationship ownership is enforced by the schema, but finer domain rules (for example a milestone belonging to the selected project) still depend partly on application logic.
- Google sign-in is the only production login method. Calendar provider-token refresh is not implemented; reconnect if access expires. Calendar currently reads primary-calendar events.
- Oura connection and OAuth-provider configuration require live verification with the installer's accounts.
- Existing lint warnings and the large main application chunk remain. The project is not claimed to be a fully hardened public SaaS.

## Smoke-test each deployment

1. Open an unconfigured local build: setup instructions should appear.
2. Install schema.sql once into a new Supabase project; verify it succeeds without historical migrations.
3. Sign in, create synthetic task/project/goal records, reload, and verify persistence.
4. In a second account, verify the first account's records are absent. Check switching accounts in another tab.
5. Create a focus session, navigate, finish it, and inspect the saved result.
6. Enable manual-token MCP, list tools, read/create synthetic records, revoke the token, and confirm subsequent protected requests fail.
7. If using OAuth MCP, verify discovery, consent, token issuance and account mapping with the intended client.
8. If enabling Calendar/Oura, test consent, sync, exact custom-domain origins, and expired-token handling.
9. Confirm frontend preview deployments, function secrets, signup rules, and operator notices match your intended audience.

## Changes made for independent installations

- Replaced migration history with one schema-only installer; removed unused legacy tables and types.
- Added same-owner compound foreign keys and a safer invoker-rights time-logging function.
- Isolated query caches and notification actions across account changes.
- Replaced personal configuration/prompts with neutral examples; removed shared development credentials and deployment automation.
- Made Calendar consent optional and integration origins configurable.
- Removed the unused privileged MCP upsert method.

## Local verification for this snapshot

- 97 frontend tests passed.
- Fresh-schema installation and ownership checks passed in in-memory PostgreSQL with synthetic auth scaffolding.
- TypeScript check and production build passed.
- Lint: 0 errors, 23 existing warnings.
- Live Supabase/PostgREST, Google, Stytch, and Oura checks remain deployment-specific and were not run.

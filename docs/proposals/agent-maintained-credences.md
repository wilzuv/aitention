# Agent-maintained hypothesis credences

Status: v1 implemented in this PR. The design below describes the longer-term contract; v1 uses one independent agent track, preserves the legacy estimate without relabelling it as human, and exposes append-only assessment history through MCP and the hypothesis UI. Explicit adoption and multiple agent tracks remain future work.

## User intent

The decision-watch agent should maintain its own probability estimates and revise them as evidence changes. The user should see who believes what, without having to supply every probability or review every routine update. Unknown remains a valid state.

## Current evidence and compatibility

The checked-in supabase/schema.sql has a single hypotheses.current_credence (non-null smallint, 0–100), and hypothesis_evidence with prior_credence and posterior_credence. The connected deployed MCP describes optional/null hypothesis credences and append_hypothesis_evidence.posterior_credence updating the shared current value. This mismatch must be reconciled against the actual deployment before a migration is written. Neither source proves a separate agent track exists. Do not infer user endorsement from historical numbers.

## Proposed behavior

Maintain separate user and agent estimates for the same falsifiable hypothesis. Display 'Your estimate' and 'Agent estimate', with independent timestamps and an optional rationale/history expansion. Missing means unquantified, never zero. A user edit must not overwrite the agent estimate, and an agent update must not overwrite the user's. Adopting an agent estimate is an explicit user action logged as such.

The agent may initialize a credence from existing evidence, then revise it only for new decision-relevant evidence or a correction to prior reasoning. Use coarse probabilities, a base rate/reference class when defensible, and a concise explanation of what changed. Leave vague/non-falsifiable or unsupported beliefs unquantified. Repeated/correlated reports are not independent updates. Silence, missing logs and inaccessible sources are not contrary evidence. Preserve evidence versus inference. Do not change a hypothesis's meaning to fit a probability.

## Data and API contract

Use an append-only credence assessment history keyed by owner, hypothesis and track. Suggested fields: id, user_id, hypothesis_id, track (user/agent), agent_key (stable for the maintained agent), prior_credence, posterior_credence (nullable 0–100), rationale, source references, observed_at, recorded_at, writer_id, run_id, model identifier when actually available, idempotency_key, and correction/supersession reference. Null transitions require an explicit reason. Keep model version as provenance rather than creating a new belief track every time the model changes.

Derive current values from this history or update materialized values atomically with the append. Use a transaction and an expected-previous-assessment ID to reject stale concurrent updates. The unique event/revision key must be independent of run_id; same-key/same-content retries return the existing result, while same-key/different-content conflicts. Compound ownership foreign keys and authenticated identity must prevent cross-account reads/writes. Track labels are attribution, not an authorization boundary by themselves; define which authenticated credentials may write each track.

Expose explicit agent-assessment writes rather than repurposing the legacy posterior_credence field. Reads return both current tracks and their provenance/history, including source references. Observation ingestion alone never changes belief. Existing qualitative hypothesis evidence remains available without a numerical update.

## Migration and interface

Inspect deployed schema and existing evidence first. Preserve legacy credences/history as legacy or unattributed unless attribution is actually recoverable. Do not copy historical values into both tracks or relabel them as human beliefs. Supply a numbered upgrade for existing installations and update the fresh-install schema, MCP schemas/handlers, TypeScript services/hooks and decision/hypothesis views together. Agent estimates need a visible label in both desktop and mobile views. Differences between estimates may invite review but must not force a user response.

## Scheduled-run rollout

The existing AiTention decision watch has been authorized to maintain agent estimates. Until separate fields are deployed, it records qualitative evidence notes labelled AGENT CREDENCE (not user-endorsed), with prior/new estimate, rationale, sources and a stable event key. It omits posterior_credence to preserve the shared field, checks history before appending and does not blindly retry uncertain writes. This fallback has no atomic deduplication guarantee and is not schema-level separation. After deployment it discovers and uses the explicit agent track, then reads back writes. Existing cadence and the 0–2 consequential-notification limit remain unchanged.

## Implementation acceptance checks

- Human and agent updates cannot overwrite one another; explicit adoption is attributable.
- Initialization from unquantified state, revisions and corrections preserve history and sources.
- Retries deduplicate atomically; stale concurrent writes conflict without partial updates.
- Cross-account access is rejected through both browser/RLS and privileged MCP paths.
- Duplicate reports, absent evidence and repeated scheduled runs cause no probability drift.
- Legacy attribution stays honest; fresh installs and upgrades produce compatible schemas.
- Both estimates, unknown states and provenance are visible on mobile without mandatory extra fields.

This proposal has been checked against the current repository schema and live tool descriptions. V1 includes runtime code and upgrade 002; no live data migration or deployment has been performed.

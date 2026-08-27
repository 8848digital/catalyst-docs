---
title: How offline sync works
description: The two synchronisation directions - server to device and device to server - how each resumes after interruption, and how push failures are classified and retried.
---

An application built on Catalyst reads from a local SQLite database and keeps that
database aligned with the server. Two independent processes do this, and they are
worth understanding separately because they behave differently and fail differently.

- **Inbound** - the server's schema and data are pulled down and applied locally.
- **Outbound** - records created on the device are queued and pushed up.

Neither runs through the same code path, and neither waits for the other.

## Everything goes through one interface

The engine performs no networking of its own. It talks to a `SyncTransport` supplied
at startup, with exactly three operations:

| Operation | Direction | Purpose |
|---|---|---|
| `getTableStructure(lastSequence)` | inbound | Schema changes after a cursor position |
| `getSyncData(sequence)` | inbound | One page of row data |
| `createRecordLog(payload)` | outbound | Push one locally created record |

That is the entire surface. A different backend means implementing these three
methods - nothing in the synchronisation logic changes.

## Inbound: schema first, then data

Inbound synchronisation runs in two phases, in order. Schema must exist before rows
can be written into it.

### Phase 1 - schema

The server owns the local schema. It sends data-definition statements as numbered
deltas, and the client applies them in sequence order.

1. Read the local cursor: `MAX(sequence)` from the `_sync_metadata` table.
2. Request everything after it.
3. Sort by sequence - the client does not trust the server's ordering.
4. Apply each statement **and record its sequence in the same transaction**.

That last point is what makes the phase resumable. If the process is interrupted
halfway through, every applied statement has its sequence committed alongside it, and
nothing is recorded for statements that did not run. The next attempt resumes exactly
where it stopped, with no replay and no gap.

The statements are not restricted to `CREATE TABLE`. The engine extracts a name from
each one only to use as a bookkeeping key, and it deliberately never throws on an
unfamiliar statement - anything unrecognised is keyed by its sequence number instead.
An `ALTER TABLE`, `CREATE INDEX`, `CREATE VIEW`, or `DROP` all apply normally. A parse
failure here would abort the entire schema sync, so the parser is allowed to fail
quietly and the sequence cursor does the real work.

### Phase 2 - data

Row data uses its own sequence enumeration, unrelated to the schema one. The client
drives the loop; the server returns no cursor.

Each request returns a single table's rows:

```json
{ "customer": [ { "name": "CUST-0001", "customer_name": "Acme Pvt Ltd" } ] }
```

The client walks `sequence = 1, 2, 3…` until the data runs out, committing **one
transaction per table**. Rows are written with `INSERT OR REPLACE`, so re-running a
sync is idempotent and always leaves the local copy matching the server.

Two details are worth knowing:

- **The end of data is signalled by an error, not an empty response.** Past the last
  table the backend returns a message like *"Sequence 5 does not exist. Maximum
  available sequence is 4."* The engine treats that as a normal stop condition and
  matches it on the message text, because the backend does not return a structured
  code for it. An empty object is also accepted as a stop condition.
- **The loop is capped at 100 sequences**, so a backend that never signals the end
  cannot spin indefinitely.

Because each table commits separately, an interruption leaves every completed table
durable. The next run simply restarts from sequence 1 and overwrites.

### A full refresh preserves the cursor

The server is the source of truth, so a full data refresh wipes local rows before
reloading. That wipe deliberately **excludes** two categories:

- `_sync_metadata` and `_sync_kv` - the schema cursor and the last-sync timestamp
- `sqlite_*` - SQLite's own internal tables

The reason is specific. Clearing `_sync_metadata` would reset the schema cursor to
zero, causing every delta to replay from the beginning. Statements like
`ALTER TABLE … ADD COLUMN` are not idempotent, so the replay would fail with
"duplicate column". Preserving the cursor keeps schema history intact while the data
is refreshed.

Foreign-key enforcement is switched off around the wipe, because the pragma cannot
change inside a transaction and inter-table references would otherwise dictate delete
order. It is restored afterwards in a `finally`.

A separate, heavier operation drops the tables *and* resets the cursor. That is the
correct tool when the local schema has drifted from the backend's - dropping alone
leaves the cursor believing the `CREATE` was applied, and resetting alone replays
`ALTER`s against a table that already has the columns.

## Outbound: the outbox

Local writes are not sent immediately. They are written to the local database with a
pending status, and a background engine drains them.

### How a feature joins the queue

The engine has no knowledge of your features. Each record type that needs pushing
registers an **outbox adapter** at startup, supplying six things:

| Member | Purpose |
|---|---|
| `name` | Stable identifier, used in diagnostics |
| `priority` | Drain order - lower drains first |
| `listPending()` | This feature's pending records, oldest first |
| `buildPayload(item)` | Serialise one record for the push endpoint |
| `markSynced(id, remoteName)` | Flip a record to synced after a confirmed acknowledgement |
| `idOf(item)` | The record's stable local id |
| `countPending()` | Count, for the badge and the refresh gate |

This is what keeps the engine free of feature imports. Adapters are iterated in
priority order; a new synced record type is included automatically once registered.

### The drain cycle

A drain is guarded by a mutex, so overlapping cycles never run. Each cycle:

1. Refresh the pending count. This happens **regardless of connectivity**, so a record
   created offline shows as pending immediately.
2. If nothing is pending, reset the backoff and stop.
3. If the device is offline, stop - a later trigger will retry.
4. For each adapter in priority order, push its records **sequentially, oldest first**,
   one HTTP call per record, marking each as synced the moment its acknowledgement
   lands.

Marking each record individually is what makes an interrupted drain safe to resume:
work already acknowledged is never repeated.

If an adapter's table does not exist yet - before the first inbound sync, or mid-wipe -
that is treated as "nothing to push" rather than an error. The engine stays quiet on
an unprovisioned database.

### Failure classification

Not every failure means the same thing, and treating them alike would either lose data
or stall the queue behind one bad record.

| Condition | Classified as | Result |
|---|---|---|
| Network error | transient | Stop the cycle, schedule a retry |
| 5xx or unknown | transient | Stop the cycle, schedule a retry |
| Structured error code from the server | permanent | Record it, **skip**, continue the queue |
| Bare 4xx | permanent | Record it, **skip**, continue the queue |

A **transient** failure means the connection is probably gone, so continuing is
pointless - the cycle stops and retries the remainder later with backoff of **5s, then
15s, then 60s**, holding at 60s. Any success resets the backoff.

A **permanent** failure means the server processed the request and rejected it.
Stopping would let one malformed record block every record behind it, so the engine
records the failure and moves on.

Critically, a permanently failing record **stays pending**. It is never flipped to a
non-pending status to get it out of the way. After five attempts it is counted in
`needsAttentionCount` and surfaced for a human, but it is never silently discarded.

### Retrying is safe

Each pushed record carries a client-generated `record_id` - the local row's stable
identifier. The backend deduplicates on it: pushing the same `record_id` again returns
the existing record rather than creating a duplicate.

This matters because the dangerous failure is not a rejected push but a **lost
acknowledgement** - the server succeeded, the response never arrived, and the record
is still marked pending locally. Server-side deduplication makes that retry harmless.

### What triggers a drain

| Trigger | When |
|---|---|
| Startup | Once, when the engine starts |
| Connectivity restored | On each offline-to-online transition |
| Explicit kick | Immediately after a record is created |
| Safety-net poll | Every 3 minutes; a no-op when nothing is pending |
| Backoff retry | After a transient failure |

The poll exists so that a missed connectivity event cannot strand the queue
indefinitely.

## Observing sync state

The engine publishes a snapshot that any component can subscribe to:

| Field | Meaning |
|---|---|
| `pendingCount` | Records waiting to be pushed |
| `isSyncing` | A drain is currently running |
| `needsAttentionCount` | Records that have failed permanently five times |
| `lastError` | Message from the most recent failure, or `null` |

The chassis exposes this through a hook backed by `useSyncExternalStore`, so it works
identically on web and React Native and re-renders only when the snapshot changes.

## What is and isn't guaranteed

**Guaranteed**

- Records push in order, oldest first, one at a time.
- No record is lost. A record that cannot be pushed remains pending and visible.
- Retries are safe - the backend deduplicates on `record_id`.
- Both inbound phases resume cleanly after interruption.
- Re-running inbound sync is idempotent.

**Not guaranteed**

- **Immediate delivery.** A record is durable locally the moment it is written; when it
  reaches the server depends on connectivity.
- **That "online" means reachable.** The connectivity check reports whether a network
  interface exists - captive portals, DNS failures, and a server that is down all still
  report online. Connectivity is a hint to attempt a push, never a promise it will
  succeed, so every push is treated as fallible.
- **Conflict resolution.** The server is the source of truth for inbound data;
  `INSERT OR REPLACE` overwrites the local copy. There is no merge step.

---

Related: [Architecture](./architecture.md) explains why the engine defines
`SyncTransport` while the chassis implements it.

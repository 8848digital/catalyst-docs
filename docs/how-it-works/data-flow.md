---
title: Data flow
description: The complete round trip - a tap on a screen, through the local database and the outbox, to the server and back.
---

The other pages describe layers and mechanisms separately. This one follows a single
piece of data all the way around, because the shape of the whole loop is what makes the
individual pieces make sense.

The rule that governs all of it: **the screen never talks to the server.** It reads from
the local database, and something else keeps that database in step with the server.

## Reading

```
Component
   │  useGetOrders()
   ▼
Hook  (useLocalQuery)                    @app/core
   │
   ▼
Repository  -- decides local or remote
   │
   ▼
data/local.ts  -- SELECT
   │
   ▼
OfflineDb  -- the contract
   │
   ▼
SQLite  -- WebAssembly + OPFS on web, react-native-sqlite-2 on native
```

Nothing here touches the network. On a device with no connection this path behaves
exactly as it does online, which is the entire point.

The only layer that knows whether the network is involved is the **repository**. Taking a
slice online means changing that one file; every layer above it is unaffected.

## Writing

```
Component
   │  executeCreateOrder(input)
   ▼
usecases.ts                              @app/core
   │  one transaction
   ▼
SQLite  -- row written with sync_status = 'pending'
   │
   ├─────▶ invalidateLocalDataAfterWrite()  ──▶ mounted screens refresh
   │
   ▼
outbox  -- the row is queued by virtue of being 'pending'
```

The write is complete and durable at this point. The user sees their record. Nothing has
been sent anywhere.

## Pushing

```
outboundSync                             @8848digital/offline-kit
   │  triggered by: startup · reconnect · kick() · 3-minute poll
   ▼
adapter.listPending()  -- oldest first
   │
   ▼
adapter.buildPayload()  -- { doctype_name, record_id, json }
   │
   ▼
SyncTransport.createRecordLog()  -- the contract
   │
   ▼
httpSyncTransport                        @8848digital/catalyst
   │
   ▼
Frappe  -- deduplicates on record_id
   │
   ▼
adapter.markSynced(id, remoteName)  -- pending becomes synced
```

Two things about this path are worth holding onto.

**The engine never knows what an order is.** It calls methods on an adapter your feature
registered. That is what keeps the engine free of any feature import.

**The engine never knows Frappe exists.** It calls `SyncTransport`, an interface it
defines. The chassis implements that interface. A different backend is a different
implementation of three methods, and the engine is untouched.

## Coming back

```
Frappe
   │
   ├─▶ getTableStructure(lastSequence)  -- schema deltas
   │        │
   │        ▼
   │   applied in order, each with its sequence, in one transaction
   │
   └─▶ getSyncData(sequence)  -- one table of rows per page
            │
            ▼
       INSERT OR REPLACE  -- one transaction per table
            │
            ▼
         SQLite
            │
            ▼
     the read path above, unchanged
```

The server owns the schema. It sends table definitions as numbered statements, and the
client applies them in order, recording each sequence in the same transaction that
applies it. That is what makes an interrupted sync resume cleanly rather than replaying
or skipping.

## The whole loop

```
        ┌──────────────────────────────────────────────┐
        │                  Component                   │
        └───────┬──────────────────────────▲───────────┘
                │ write                    │ read
                ▼                          │
        ┌───────────────┐          ┌───────────────┐
        │   usecases    │          │ hook -> repo  │
        └───────┬───────┘          └───────▲───────┘
                │                          │
                ▼                          │
        ┌──────────────────────────────────┴───────────┐
        │            local SQLite database             │
        └───────┬──────────────────────────▲───────────┘
                │ pending rows             │ rows + schema
                ▼                          │
        ┌───────────────┐          ┌───────────────┐
        │  outboundSync │          │ inbound sync  │
        └───────┬───────┘          └───────▲───────┘
                │                          │
                └──────────┬───────────────┘
                           ▼
                    ┌─────────────┐
                    │   Frappe    │
                    └─────────────┘
```

The local database is the centre. Everything the user sees comes out of it, and both
synchronisation directions exist to keep it aligned with the server.

## Why it is arranged this way

- **The screen is never blocked on the network.** Reads and writes complete against local storage, so connectivity affects when data reaches the server, never whether the application works.
- **One decision point for local versus remote.** The repository, and nothing else.
- **The engine is reusable because it knows nothing.** Not your features, not your backend, not your platform. Everything concrete arrives through an interface it defined and something else implemented.
- **The same diagram describes web and native.** Only the bottom box differs: one SQLite implementation per platform, chosen at startup.

---

Related: [Offline sync](./offline-sync.md) for the mechanics of each direction, and
[Architecture](./architecture.md) for the layers this flows through.

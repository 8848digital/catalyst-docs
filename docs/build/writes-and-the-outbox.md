---
title: Writes and the outbox
description: How a record created offline is written locally, queued, and pushed to the server, and what you have to register at startup for it to work.
---

Reading data is straightforward: the repository decides local or remote, and the hook
renders it. Writing is different, because the write has to succeed whether or not there
is a connection.

The answer is that a write never goes to the server directly. It is written to the local
database marked as pending, and a background engine pushes it when it can.

## The two files a write adds

A read-only slice has `hooks`, `repo`, and `data/`. A slice that writes adds two more:

| File | Job |
|---|---|
| `usecases.ts` | Perform the local write, in one transaction, marked `pending` |
| `outbox.ts` | List what is pending, serialise it, and mark it synced after the server confirms |

Both are permitted to import `getOfflineDb` and run SQL. Hooks and repositories still are
not.

## Generate it

```
/feature-slice new slice orders
```

Tell the skill the feature writes, and it produces `usecases.ts` and `outbox.ts` along
with the read layers. The rest of this page is what it generates and why.

## The local write

```ts title="packages/core/src/features/orders/usecases.ts"
import { getOfflineDb, insertRow } from '@8848digital/offline-kit';
import { generateUuid, invalidateLocalDataAfterWrite } from '@8848digital/catalyst';
import type { CreateOrderLocalInput } from './orders.types';

export interface CreateOrderResult {
  orderId: string;
}

export async function executeCreateOrder(input: CreateOrderLocalInput): Promise<CreateOrderResult> {
  const orderId = generateUuid();
  const createdAt = new Date().toISOString();
  const db = await getOfflineDb();

  await db.transaction(async (tx) => {
    await insertRow(tx, 'order', {
      id: orderId,
      customer: input.customer,
      total_amount: input.total_amount,
      sync_status: 'pending',
      remote_name: null,
      created_at: createdAt,
    });

    for (const line of input.items) {
      await insertRow(tx, 'order_item', {
        id: generateUuid(),
        order: orderId,
        item_code: line.item_code,
        qty: line.qty,
      });
    }
  });

  invalidateLocalDataAfterWrite();
  return { orderId };
}
```

Five rules are doing work here:

- **One transaction.** A parent row and its children commit together or not at all. A throw anywhere inside rolls the whole thing back.
- **A locally generated id.** The record exists and is referenceable before the server has ever seen it. This id is also what makes retries safe, below.
- **`sync_status: 'pending'`** is what puts the record in the queue. Nothing else registers it.
- **`remote_name: null`** until the server assigns one.
- **`invalidateLocalDataAfterWrite()`** refreshes any mounted screen reading that table, so the new record appears immediately rather than on the next remount.

## The push side

```ts title="packages/core/src/features/orders/outbox.ts"
import { getOfflineDb, type CreateRecordLogPayload, type OutboxAdapter } from '@8848digital/offline-kit';
import type { PendingOrder, OrderRow, OrderItemRow } from './orders.types';

export async function listPendingOrders(): Promise<PendingOrder[]> {
  const db = await getOfflineDb();
  const orders = await db.all<OrderRow>(`SELECT * FROM "order" WHERE sync_status = 'pending' ORDER BY created_at ASC`);

  const out: PendingOrder[] = [];
  for (const order of orders) {
    const items = await db.all<OrderItemRow>('SELECT * FROM order_item WHERE "order" = ?', [order.id]);
    out.push({ order, items });
  }
  return out;
}

export function buildOrderSyncPayload(pending: PendingOrder): CreateRecordLogPayload {
  const record = {
    customer: pending.order.customer,
    total_amount: pending.order.total_amount,
    items: pending.items.map((l) => ({ item_code: l.item_code, qty: l.qty })),
  };

  return {
    doctype_name: 'Order',
    record_id: pending.order.id,
    json: JSON.stringify(record),
  };
}

export async function markOrderSynced(orderId: string, remoteName: string): Promise<void> {
  const db = await getOfflineDb();
  await db.exec(`UPDATE "order" SET sync_status = 'synced', remote_name = ? WHERE id = ?`, [remoteName, orderId]);
}

export const orderOutboxAdapter: OutboxAdapter<PendingOrder> = {
  name: 'order',
  priority: 10,
  listPending: listPendingOrders,
  buildPayload: buildOrderSyncPayload,
  markSynced: markOrderSynced,
  idOf: (p) => p.order.id,
  countPending: async () => (await listPendingOrders()).length,
};
```

Three details matter more than they look.

**`ORDER BY created_at ASC`.** The engine pushes sequentially, oldest first. If the
ordering is wrong here, records reach the server out of order.

**`json` is a stringified record, not a nested object.** That is the backend's contract,
and this file is the single place the mapping between your local columns and the server's
field names lives. Confirm those field names with the backend rather than inferring them.

**`record_id` is the local id.** The server deduplicates on it, so pushing the same record
twice returns the existing one instead of creating a duplicate. This is what makes retries
safe, and the failure it protects against is not a rejected push but a **lost
acknowledgement**: the server succeeded, the response never arrived, and the record is
still marked pending locally.

**`priority`** decides drain order across features. Lower drains first. Use it when one
record type must reach the server before another.

## Register it at startup

The engine holds no list of features. An adapter that is never registered is never
drained, and this fails silently rather than loudly.

In both `apps/web/app/providers.tsx` and `apps/native/src/bootstrap.ts`:

```ts
import { registerOutboxAdapter, outboundSync } from '@8848digital/offline-kit';
import { registerInvalidationKeys } from '@8848digital/catalyst';
import { orderOutboxAdapter, PRODUCT_INVALIDATION_KEYS } from '@app/core';

registerOutboxAdapter(orderOutboxAdapter);
registerInvalidationKeys(PRODUCT_INVALIDATION_KEYS);

outboundSync.start();
```

:::warning[Register before starting]

`registerOutboxAdapter` must run **before** `outboundSync.start()`. The template calls
`start()` at the end of the boot block for exactly this reason.

:::

And add the slice's read keys so writes refresh the right views:

```ts title="packages/core/src/invalidationKeys.ts"
export const PRODUCT_INVALIDATION_KEYS: readonly (readonly unknown[])[] = [['orders']];
```

Empty in the template. `invalidateLocalDataAfterWrite()` iterates this list, so a key
that is missing here means the screen will not refresh after a write.

## What happens next

Once registered, the record is the engine's responsibility. It drains sequentially and
oldest-first, stops and retries with backoff on a network failure, and skips a record the
server rejects outright so one bad record cannot block the queue behind it.

A record that keeps failing **stays pending**. It is never flipped to a non-pending status
to get it out of the way, and after five attempts it is counted in `needsAttentionCount`
for a human to look at.

[Offline sync](../how-it-works/offline-sync.md) covers the drain cycle, the failure
classification, and the retry schedule in full.

## Showing it in the interface

```tsx
import { useOutboxStatus } from '@8848digital/catalyst';

const { pendingCount, isSyncing, needsAttentionCount } = useOutboxStatus();
```

Backed by `useSyncExternalStore`, so it works identically on web and native and re-renders
only when the snapshot changes.

Showing `pendingCount` is worth doing early. Offline-first applications feel broken
without it, because a user who creates a record and sees no confirmation assumes it was
lost.

## What to check

Generated write code is structurally correct and needs review where judgement was
involved:

1. **The field mapping in `buildPayload`** against the backend's actual field names. Nothing catches a wrong name until a push is rejected.
2. **The pending query** - the `WHERE` clause and the `ORDER BY`.
3. **`markSynced` updates the right row**, and only after a confirmed acknowledgement.
4. **The adapter is registered** in both boot files, before `start()`.
5. **The invalidation key** is in `PRODUCT_INVALIDATION_KEYS`.

Then test it properly: create a record in airplane mode, confirm it appears as pending,
restore the connection, and confirm it reaches the server exactly once.

---

Related: [Offline sync](../how-it-works/offline-sync.md) for what the engine does with
the queue, and [Data flow](../how-it-works/data-flow.md) for the whole round trip.

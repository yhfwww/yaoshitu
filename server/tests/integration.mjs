// Run against a disposable PocketBase only. Credentials come from environment.
import assert from "node:assert/strict";
import PocketBase from "../../src/node_modules/pocketbase/dist/pocketbase.es.mjs";
import { writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
const url = process.env.PB_TEST_URL || "http://127.0.0.1:8099";
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) throw new Error("Tests require a local disposable server");
const admin = new PocketBase(url);
await admin.collection("_superusers").authWithPassword(process.env.PB_TEST_ADMIN, process.env.PB_TEST_PASSWORD);
const suffix = Date.now();
const a = await admin.collection("users").create({ email: `a${suffix}@example.invalid`, password: "LocalTestPassword0123456789", passwordConfirm: "LocalTestPassword0123456789" });
const b = await admin.collection("users").create({ email: `b${suffix}@example.invalid`, password: "LocalTestPassword0123456789", passwordConfirm: "LocalTestPassword0123456789" });
const client = await admin.collection("users").impersonate(a.id, 3600);
const other = await admin.collection("users").impersonate(b.id, 3600);
const makeOp = (over = {}) => ({ id: crypto.randomUUID(), key: "task:sample", kind: "task", entityId: "sample", baseRevision: 0, expectedRevision: 0, purge: false, changes: {}, ...over });
const push = (op, pb = client) => pb.send("/api/yaoshitu/push", { method: "POST", body: op });
const pull = (pb = client) => pb.send("/api/yaoshitu/pull", { method: "GET" });
let stream;
let buffer = "";
async function event() {
  while (!buffer.includes("\n\n")) {
    const chunk = await stream.read();
    if (chunk.done) throw new Error("SSE ended early");
    buffer += new TextDecoder().decode(chunk.value).replace(/\r\n/g, "\n");
  }
  const boundary = buffer.indexOf("\n\n");
  const message = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
  const payload = message.split("\n").find(line => line.startsWith("data:"));
  return payload ? JSON.parse(payload.slice(5).trim()) : event();
}
try {
  const methods = await client.collection("users").listAuthMethods();
  assert.equal(methods.password.enabled, false);
  await assert.rejects(new PocketBase(url).send("/api/yaoshitu/pull", { method: "GET" }), e => e.status === 401);
  const realtime = await fetch(`${url}/api/realtime`, { signal: AbortSignal.timeout(15000) });
  stream = realtime.body.getReader();
  const connection = await event();
  await client.send("/api/realtime", { method: "POST", body: { clientId: connection.clientId, subscriptions: ["sync_documents/*"] } });
  const initial = makeOp({ changes: { title: "PRIVATE-TITLE", notes: "SECRET-NOTE", position: { urgency: 30, importance: 80 }, completion: { completed: false, completedAt: null }, archived: false, createdAt: Date.now(), dueAt: null, deletedAt: null, tags: [], parentId: null, recurrence: null, timeEntries: [], dependencies: [], reminderAt: null } });
  const one = await push(initial);
  assert.equal(one.revision, 1);
  const notification = await event();
  assert.equal(notification.action, "create");
  assert.equal(notification.record.owner, a.id);
  assert.equal(notification.record.sealed, undefined, "SSE wakes the client without exposing sealed payload");
  await stream.cancel(); stream = undefined;
  if (process.env.PB_TEST_DATA) {
    const sqlite = new DatabaseSync(process.env.PB_TEST_DATA, { readOnly: true });
    const sealed = sqlite.prepare("SELECT sealed FROM sync_documents WHERE owner = ? AND key = ?").get(a.id, initial.key).sealed;
    assert.ok(sealed.length > 50);
    assert.ok(!sealed.includes("PRIVATE-TITLE") && !sealed.includes("SECRET-NOTE"), "database must not store task content as plaintext");
    sqlite.close();
    const backup = `integration-${suffix}.zip`;
    await admin.backups.create(backup);
    assert.ok((await admin.backups.getFullList()).some(item => item.key === backup));
    await writeFile(new URL("../../.tmp/recovery-manifest.json", import.meta.url), JSON.stringify({ backup, userId: a.id }));
    console.log("PASS: SQLite content encryption and server snapshot creation");
  }
  assert.equal((await push(initial)).revision, 1, "lost-response retry must be idempotent");
  assert.equal((await pull(other)).items.length, 0, "other account cannot read tasks");
  await assert.rejects(client.collection("sync_documents").create({ owner: a.id, key: "task:illegal" }), e => e.status === 403);
  const rows = await client.collection("sync_documents").getFullList();
  assert.equal(rows[0].sealed, undefined, "encrypted payload is hidden from ordinary record API");
  const adminRows = await admin.collection("sync_documents").getFullList({ query: { fields: "id,owner,key,sealed" } });
  const own = adminRows.find(row => row.owner === a.id);
  // Hidden fields are also omitted for superusers unless explicitly requested by
  // server code. The storage-level encryption assertion is in protocol tests.
  assert.ok(own);
  const two = await push(makeOp({ baseRevision: 1, expectedRevision: 1, changes: { title: "NEW-TITLE" } }));
  assert.equal(two.revision, 2);
  const concurrent = makeOp({ baseRevision: 1, expectedRevision: 1, changes: { dueAt: 1900000000000 } });
  await assert.rejects(push(concurrent), e => e.status === 409 && e.response.document.revision === 2);
  const three = await push({ ...concurrent, expectedRevision: 2 });
  assert.equal(three.values.title, "NEW-TITLE");
  assert.equal(three.values.dueAt, 1900000000000, "different field edits must both survive");
  const four = await push(makeOp({ baseRevision: 1, expectedRevision: 3, changes: { title: "OTHER-TITLE" } }));
  assert.equal(four.conflicts[0].value, "NEW-TITLE", "same-field conflict remains recoverable");
  await assert.rejects(push(makeOp({ baseRevision: 4, expectedRevision: 4, changes: { owner: b.id } })), e => e.status === 400);
  const deleted = await push(makeOp({ baseRevision: 4, expectedRevision: 4, changes: { deletedAt: 1 } }));
  assert.ok(deleted.values.deletedAt > Date.now() - 10000, "server owns retention clock");
  const purged = await push(makeOp({ baseRevision: 5, expectedRevision: 5, purge: true }));
  assert.equal(purged.purged, true);
  assert.deepEqual(purged.values, {});
  const resurrect = await push(makeOp({ changes: initial.changes }));
  assert.equal(resurrect.purged, true, "long-offline edits cannot resurrect permanent tombstones");
  const accountToken = client.authStore.token;
  await client.send("/api/yaoshitu/account", { method: "DELETE" });
  client.authStore.save(accountToken, a);
  await assert.rejects(pull(), e => e.status === 401);
  assert.equal((await admin.collection("sync_documents").getFullList()).filter(row => row.owner === a.id).length, 0);
  assert.equal((await admin.collection("sync_receipts").getFullList()).filter(row => row.owner === a.id).length, 0);
  console.log("PASS: authentication, owner isolation, locked writes, hidden payload, idempotency, revision check, field merge, conflict recovery, server retention clock, tombstones, account deletion cascade");
} finally {
  if (stream) await stream.cancel();
  for (const id of [a.id, b.id]) { try { await admin.collection("users").delete(id); } catch {} }
}

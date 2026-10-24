// Disposable localhost only; never run against production.
import assert from "node:assert/strict";
import PocketBase from "../../src/node_modules/pocketbase/dist/pocketbase.es.mjs";
const url = process.env.PB_TEST_URL || "http://127.0.0.1:8112";
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) throw new Error("Local disposable server required");
const admin = new PocketBase(url);
await admin.collection("_superusers").authWithPassword(process.env.PB_TEST_ADMIN, process.env.PB_TEST_PASSWORD);
const client = new PocketBase(url);
const email = `email-${Date.now()}@example.invalid`;
const password = "DisposablePassword12345";
const user = await client.collection("users").create({ email, password, passwordConfirm: password });
try {
  await assert.rejects(client.collection("users").authWithPassword(email, password), (e) => e.status === 403);
  await assert.rejects(client.collection("users").create({ email: `spoof-${email}`, password, passwordConfirm: password, verified: true }));
  await assert.rejects(client.collection("users").update(user.id, { verified: true }));
  await admin.collection("users").update(user.id, { verified: true });
  const auth = await client.collection("users").authWithPassword(email, password);
  assert.equal(auth.record.id, user.id);
  assert.deepEqual((await client.send("/api/yaoshitu/pull", { method: "GET" })).items, []);
  const otherUsers = await client.collection("users").getList(1, 20, { filter: `id != '${user.id}'` });
  assert.equal(otherUsers.items.length, 0);
  const collection = await admin.collections.getOne("users");
  assert.ok(collection.verificationTemplate.body.includes("/#verify/{TOKEN}"));
  assert.ok(collection.resetPasswordTemplate.body.includes("/#reset/{TOKEN}"));
  console.log("PASS: registration, unverified denial, verified login, permission isolation, email action URLs");
} finally { await admin.collection("users").delete(user.id); }

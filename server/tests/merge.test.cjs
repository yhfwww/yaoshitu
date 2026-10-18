const { test } = require("node:test");
const assert = require("node:assert/strict");
const { merge, expire } = require("../pb_hooks/merge.cjs");
const operation = (over = {}) => ({ id: "operation", key: "note:example", kind: "note", entityId: "example", baseRevision: 0, expectedRevision: 0, purge: false, changes: { title: "原则", body: "正文", tags: [], pinned: false, createdAt: 1, deletedAt: null }, ...over });
test("different fields merge, stale expected revision returns conflict, same field keeps old value", () => {
  const first = merge(null, operation(), 1).document;
  const second = merge(first, operation({ baseRevision: 1, expectedRevision: 1, changes: { title: "新标题" } }), 2).document;
  assert.equal(merge(second, operation({ baseRevision: 1, expectedRevision: 1, changes: { body: "新正文" } }), 3).conflict.revision, 2);
  const third = merge(second, operation({ baseRevision: 1, expectedRevision: 2, changes: { body: "新正文" } }), 3).document;
  assert.equal(third.values.title, "新标题");
  assert.equal(third.values.body, "新正文");
  assert.equal(third.conflicts.length, 0);
  const fourth = merge(third, operation({ baseRevision: 1, expectedRevision: 3, changes: { title: "另一端标题" } }), 4).document;
  assert.equal(fourth.conflicts[0].value, "新标题");
});
test("retention uses server time, 30-day expiry discards content and permanently blocks resurrection", () => {
  const now = 1800000000000;
  const first = merge(null, operation(), now).document;
  const deleted = merge(first, operation({ baseRevision: 1, expectedRevision: 1, changes: { deletedAt: 1 } }), now).document;
  assert.equal(deleted.values.deletedAt, now);
  assert.equal(expire(deleted, now + 29 * 86400000).purged, false);
  const tombstone = expire(deleted, now + 30 * 86400000);
  assert.equal(tombstone.purged, true);
  assert.deepEqual(tombstone.values, {});
  assert.deepEqual(tombstone.conflicts, []);
  assert.equal(merge(tombstone, operation(), now).document.purged, true);
});
test("rejects malformed fields, partial creation, future revisions and direct purge of live content", () => {
  assert.throws(() => merge(null, operation({ changes: { title: "incomplete" } }), 1));
  assert.throws(() => merge(null, operation({ changes: { ...operation().changes, owner: "someone" } }), 1));
  assert.throws(() => merge(null, operation({ baseRevision: 2, expectedRevision: 1 }), 1));
  const first = merge(null, operation(), 1).document;
  assert.throws(() => merge(first, operation({ baseRevision: 1, expectedRevision: 1, purge: true, changes: {} }), 2));
});

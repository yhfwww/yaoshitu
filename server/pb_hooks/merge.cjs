"use strict";

// Shared pure protocol logic; tested outside PocketBase as well.
const FIELDS = {
  task: ["title", "notes", "position", "completion", "archived", "createdAt", "dueAt", "deletedAt", "tags", "parentId", "recurrence", "timeEntries", "dependencies", "reminderAt"],
  note: ["title", "body", "tags", "pinned", "createdAt", "deletedAt"],
  settings: ["defaultView"],
};
function fail() { throw new Error("Invalid sync payload"); }
function text(v, max) { return typeof v === "string" && v.length <= max; }
function time(v) { return typeof v === "number" && isFinite(v) && v >= 0; }
function strings(v) { return Array.isArray(v) && v.length <= 1000 && v.every(x => text(x, 1000)); }
function validate(op) {
  if (!op || !FIELDS[op.kind] || !text(op.entityId, 200) || !/^[a-zA-Z0-9_-]+$/.test(op.entityId) || !text(op.id, 200) || !/^[a-zA-Z0-9_-]+$/.test(op.id) || op.key !== op.kind + ":" + op.entityId || typeof op.purge !== "boolean" || !Number.isSafeInteger(op.baseRevision) || op.baseRevision < 0 || !Number.isSafeInteger(op.expectedRevision) || op.expectedRevision < op.baseRevision || !op.changes || typeof op.changes !== "object" || Array.isArray(op.changes)) fail();
  if (op.kind === "settings" && (op.entityId !== "app" || op.purge)) fail();
  if (JSON.stringify(op.changes).length > 500000) fail();
  for (const k of Object.keys(op.changes)) {
    const v = op.changes[k];
    if (!FIELDS[op.kind].includes(k)) fail();
    if (["title", "notes", "body"].includes(k) && (!text(v, k === "title" ? 1000 : 200000) || (k === "title" && !v.trim()))) fail();
    if (["archived", "pinned"].includes(k) && typeof v !== "boolean") fail();
    if (k === "createdAt" && !time(v)) fail();
    if (["dueAt", "deletedAt", "reminderAt"].includes(k) && v !== null && !time(v)) fail();
    if (["tags", "dependencies"].includes(k) && !strings(v)) fail();
    if (k === "parentId" && v !== null && !text(v, 200)) fail();
    if (k === "recurrence" && v !== null && !["daily", "weekly", "monthly"].includes(v)) fail();
    if (k === "position" && (!v || ![v.urgency, v.importance].every(n => Number.isInteger(n) && n >= 1 && n <= 100) || Object.keys(v).some(x => !["urgency", "importance"].includes(x)))) fail();
    if (k === "completion" && (!v || typeof v.completed !== "boolean" || (v.completedAt !== null && !time(v.completedAt)) || Object.keys(v).some(x => !["completed", "completedAt"].includes(x)))) fail();
    if (k === "timeEntries" && (!Array.isArray(v) || v.length > 10000 || v.some(x => !x || !text(x.id, 200) || !time(x.startedAt) || (x.endedAt !== undefined && !time(x.endedAt)) || (x.note !== undefined && !text(x.note, 200000)) || Object.keys(x).some(f => !["id", "startedAt", "endedAt", "note"].includes(f))))) fail();
    if (k === "defaultView" && !["coordinate", "matrix", "list", "smart", "dashboard", "principles", "archive"].includes(v)) fail();
  }
}
function merge(current, op, now) {
  validate(op);
  const doc = current ? JSON.parse(JSON.stringify(current)) : { key: op.key, entityId: op.entityId, kind: op.kind, revision: 0, values: {}, versions: {}, conflicts: [], purged: false };
  if (doc.purged) return { document: doc };
  if (doc.revision !== op.expectedRevision) return { conflict: doc };
  if (op.baseRevision > doc.revision) fail();
  if (!current && !op.purge && FIELDS[op.kind].some(k => !Object.prototype.hasOwnProperty.call(op.changes, k))) fail();
  if (op.purge && current && !doc.values.deletedAt) fail();
  doc.revision++;
  if (op.purge) {
    doc.purged = true; doc.values = {}; doc.versions = {}; doc.conflicts = [];
    return { document: doc };
  }
  for (const field of Object.keys(op.changes)) {
    let value = op.changes[field];
    if (field === "deletedAt" && value !== null) value = doc.values.deletedAt || now;
    if ((doc.versions[field] || 0) > op.baseRevision && JSON.stringify(doc.values[field]) !== JSON.stringify(value)) {
      doc.conflicts.push({ field, value: doc.values[field], revision: doc.versions[field] });
    }
    doc.values[field] = value;
    doc.versions[field] = doc.revision;
  }
  doc.values.updatedAt = now;
  // History is bounded and retained inside the encrypted document.
  doc.conflicts = doc.conflicts.slice(-100);
  while (doc.conflicts.length && JSON.stringify(doc.conflicts).length > 2000000) doc.conflicts.shift();
  return { document: doc };
}
function expire(doc, now) {
  if (doc.purged || !doc.values.deletedAt || doc.values.deletedAt > now - 30 * 86400000) return doc;
  return Object.assign({}, doc, { revision: doc.revision + 1, purged: true, values: {}, versions: {}, conflicts: [] });
}
module.exports = { validate, merge, expire };

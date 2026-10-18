import type { EntityKind, SyncValues } from "../../db/schema";

// Compound values are atomic: never combine coordinates or completion metadata
// from two different user actions. Null explicitly clears an optional field.
export function encodeValues(kind: EntityKind, source: object): SyncValues {
  const value = JSON.parse(JSON.stringify(source)) as SyncValues;
  delete value.id;
  delete value.updatedAt;
  if (kind === "task") {
    value.position = { urgency: value.urgency, importance: value.importance };
    value.completion = { completed: value.completed, completedAt: value.completedAt ?? null };
    for (const key of ["urgency", "importance", "completed", "completedAt"]) delete value[key];
    for (const key of ["dueAt", "deletedAt", "parentId", "recurrence", "reminderAt"]) value[key] ??= null;
  }
  if (kind === "note") value.deletedAt ??= null;
  if (kind === "settings") return { defaultView: value.defaultView };
  return value;
}

export function decodeValues(kind: EntityKind, values: SyncValues, id: string): SyncValues {
  const result: SyncValues = { ...values, id };
  if (kind === "task") {
    Object.assign(result, values.position, values.completion);
    delete result.position;
    delete result.completion;
  }
  for (const key of Object.keys(result)) if (result[key] === null) result[key] = undefined;
  return result;
}

export function changedValues(kind: EntityKind, before: object | undefined, after: object): SyncValues {
  const previous = before ? encodeValues(kind, before) : {};
  const next = encodeValues(kind, after);
  return Object.fromEntries(Object.entries(next).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(previous[key])));
}

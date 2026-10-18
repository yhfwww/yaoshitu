import type { SyncDocument, SyncOperation } from "../../db/schema";
import { getClient } from "./client";

// The merge/outbox protocol does not depend on a backend SDK.
export interface SyncTransport {
  push(operation: SyncOperation, expectedRevision: number): Promise<SyncDocument>;
  pull(after: string): Promise<{ items: SyncDocument[]; after: string }>;
  subscribe(onChange: () => void): Promise<() => void>;
}

export const transport: SyncTransport = {
  push: (operation, expectedRevision) => getClient().send("/api/yaoshitu/push", { method: "POST", body: { ...operation, expectedRevision } }),
  pull: (after) => getClient().send("/api/yaoshitu/pull", { method: "GET", query: { after } }),
  subscribe: (onChange) => getClient().collection("sync_documents").subscribe("*", onChange),
};

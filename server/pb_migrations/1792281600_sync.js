migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.listRule = "id = @request.auth.id";
  users.viewRule = "id = @request.auth.id";
  users.createRule = null; users.updateRule = null; users.deleteRule = null;
  users.passwordAuth = { enabled: false };
  users.otp = { enabled: false };
  users.oauth2 = { enabled: true, providers: [] };
  app.save(users);
  app.save(new Collection({
    type: "base", name: "sync_documents",
    listRule: "owner = @request.auth.id", viewRule: "owner = @request.auth.id",
    createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "owner", type: "relation", collectionId: users.id, cascadeDelete: true, required: true, maxSelect: 1 },
      { name: "key", type: "text", required: true, max: 220 },
      { name: "sealed", type: "text", hidden: true, max: 10000000 },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_sync_owner_key ON sync_documents (owner, key)"],
  }));
  app.save(new Collection({
    type: "base", name: "sync_receipts",
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "owner", type: "relation", collectionId: users.id, cascadeDelete: true, required: true, maxSelect: 1 },
      { name: "operation", type: "text", required: true, max: 200 },
      { name: "key", type: "text", required: true, max: 220 },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_receipt_owner_op ON sync_receipts (owner, operation)"],
  }));
  const settings = app.settings();
  settings.meta.appName = "要事图";
  settings.logs.logIP = false;
  settings.logs.logAuthId = false;
  settings.logs.maxDays = 7;
  settings.backups.cron = "0 3 * * *";
  settings.backups.cronMaxKeep = 7;
  settings.rateLimits.enabled = true;
  app.save(settings);
});

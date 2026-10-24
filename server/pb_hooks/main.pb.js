onBootstrap((e) => {
  require(__hooks + "/service.cjs").key();
  e.next();
});

onRecordAuthWithOAuth2Request((e) => {
  if (e.providerName !== "github") throw new ForbiddenError("首版仅支持 GitHub 登录");
  e.next();
}, "users");

onRecordAuthWithPasswordRequest((e) => {
  if (e.record && e.record.validatePassword(e.password) && !e.record.getBool("verified")) {
    throw new ForbiddenError("请先验证邮箱，再登录");
  }
  e.next();
}, "users");

routerAdd("POST", "/api/yaoshitu/push", (e) => {
  const service = require(__hooks + "/service.cjs");
  const protocol = require(__hooks + "/merge.cjs");
  const op = e.requestInfo().body;
  try { protocol.validate(op); } catch { throw new BadRequestError("同步数据格式不合法"); }
  const owner = e.auth.id;
  let response;
  let conflict = false;
  e.app.runInTransaction((app) => {
    let record = service.find(app, owner, op.key);
    let current = record ? service.read(record) : null;
    if (current) {
      const expired = protocol.expire(current, Date.now());
      if (expired !== current) { current = expired; service.save(app, record, current); }
    }
    const receipts = app.findRecordsByFilter("sync_receipts", "owner = {:owner} && operation = {:op}", "", 1, 0, { owner, op: op.id });
    if (receipts.length) {
      if (receipts[0].getString("key") !== op.key || !current) throw new BadRequestError("操作标识重复");
      response = current;
      return;
    }
    let result;
    try { result = protocol.merge(current, op, Date.now()); } catch { throw new BadRequestError("同步数据不完整或操作无效"); }
    if (result.conflict) { conflict = true; response = result.conflict; return; }
    response = result.document;
    if (!record) {
      record = new Record(app.findCollectionByNameOrId("sync_documents"));
      record.set("owner", owner); record.set("key", op.key);
    }
    service.save(app, record, response);
    const receipt = new Record(app.findCollectionByNameOrId("sync_receipts"));
    receipt.set("owner", owner); receipt.set("operation", op.id); receipt.set("key", op.key);
    app.save(receipt);
  });
  return e.json(conflict ? 409 : 200, conflict ? { document: service.publicDocument(response) } : service.publicDocument(response));
}, $apis.requireAuth("users"), $apis.bodyLimit(1024 * 1024));

routerAdd("GET", "/api/yaoshitu/pull", (e) => {
  const service = require(__hooks + "/service.cjs");
  const after = e.request.url.query().get("after") || "";
  const records = e.app.findRecordsByFilter("sync_documents", "owner = {:owner} && key > {:after}", "key", 100, 0, { owner: e.auth.id, after });
  return e.json(200, { items: records.map(r => service.publicDocument(service.read(r))), after: records.length === 100 ? records[records.length - 1].getString("key") : "" });
}, $apis.requireAuth("users"));

routerAdd("DELETE", "/api/yaoshitu/account", (e) => {
  // Owner relations cascade to documents and operation receipts atomically.
  e.app.runInTransaction((app) => app.delete(app.findRecordById("users", e.auth.id)));
  return e.noContent(204);
}, $apis.requireAuth("users"));

cronAdd("yaoshitu_retention", "0 * * * *", () => {
  const service = require(__hooks + "/service.cjs");
  const protocol = require(__hooks + "/merge.cjs");
  let after = "";
  while (true) {
    const records = $app.findRecordsByFilter("sync_documents", "id > {:after}", "id", 100, 0, { after });
    for (const item of records) {
      $app.runInTransaction((app) => {
        const record = app.findRecordById("sync_documents", item.id);
        const doc = service.read(record);
        const next = protocol.expire(doc, Date.now());
        if (next !== doc) service.save(app, record, next);
      });
    }
    if (records.length < 100) break;
    after = records[records.length - 1].id;
  }
});

"use strict";
function key() {
  const value = $os.getenv("YAOSHITU_DATA_KEY");
  if (!/^[A-Za-z0-9]{32}$/.test(value)) throw new Error("YAOSHITU_DATA_KEY must be 32 random ASCII alphanumeric characters");
  return value;
}
function read(record) { return JSON.parse($security.decrypt(record.getString("sealed"), key())); }
function save(app, record, document) {
  record.set("sealed", $security.encrypt(JSON.stringify(document), key()));
  app.save(record);
}
function find(app, owner, name) {
  return app.findRecordsByFilter("sync_documents", "owner = {:owner} && key = {:key}", "", 1, 0, { owner, key: name })[0] || null;
}
function publicDocument(doc) {
  const result = Object.assign({}, doc);
  delete result.versions;
  return result;
}
module.exports = { key, read, save, find, publicDocument };

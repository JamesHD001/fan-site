const { MongoMemoryServer } = require("mongodb-memory-server");
MongoMemoryServer.create({ instance: { storageEngine: "wiredTiger" }, binary: { version: "7.0.14" } })
  .then((m) => { console.log("URI:" + m.getUri()); return new Promise(() => { }); })
  .catch((e) => { console.error("ERR", e); process.exit(1); });

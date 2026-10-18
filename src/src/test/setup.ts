// 所有测试文件在被求值之前都会先跑一遍这里。
//
// 必须在最前面装上假的 IndexedDB：src/db/db.ts 是在**模块顶层**就 `new YaoshituDB()`，
// 只要它先于 IndexedDB 被求值，Dexie 就会在打开库时报错。
import "fake-indexeddb/auto";

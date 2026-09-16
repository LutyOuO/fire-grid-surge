'use strict';
// 唯一测试入口：各测试独立进程，不共享全局状态或测试存档。
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const tests = fs.readdirSync(__dirname).filter(name => /^test-.+\.cjs$/.test(name)).sort();
let failed = 0;
for (const test of tests) {
  console.log('\n[TEST] ' + test);
  const result = spawnSync(process.execPath, [path.join(__dirname, test)], { cwd: __dirname, stdio: 'inherit', timeout: 60000 });
  if (result.error || result.status !== 0) { failed++; if (result.error) console.error(result.error.message); }
}
console.log('\n测试结果：' + (tests.length - failed) + '/' + tests.length + ' 通过');
process.exitCode = failed ? 1 : 0;

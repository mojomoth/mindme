import { createRequire } from 'node:module';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire('/Users/jeongyounglee/work/repo/mindme/node_modules/.pnpm/ignore@7.0.14/node_modules/ignore/package.json');
const ignore = require('/Users/jeongyounglee/work/repo/mindme/node_modules/.pnpm/ignore@7.0.14/node_modules/ignore');
const ROOT = '/Users/jeongyounglee/work/repo/mindme';
// Vercel CLI 기본 무시 목록 (.env 는 기본 목록에 없다)
const DEFAULTS = ['.hg', '.git', '.gitmodules', '.svn', '.cache', '.next', '.now', '.vercel', '.npmignore', '.dockerignore', '.gitignore', '.*.swp', '.DS_Store', '.wafpicke-*', '.lock-wscript', '.env.local', '.env.*.local', '.venv', 'npm-debug.log', 'config.gypi', 'node_modules', '__pycache__', 'venv', 'CVS'];
const vi = await readFile(path.join(ROOT, '.vercelignore'), 'utf8');
const withIgnore = ignore().add(DEFAULTS).add(vi);
const withoutIgnore = ignore().add(DEFAULTS);
const files = [];
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const rel = path.relative(ROOT, path.join(dir, e.name));
    if (e.name === '.git' || e.name === 'node_modules' || e.name === '.next') continue;
    if (e.isDirectory()) await walk(path.join(dir, e.name));
    else files.push(rel);
  }
}
await walk(ROOT);
const up = files.filter((f) => !withIgnore.ignores(f));
const upBefore = files.filter((f) => !withoutIgnore.ignores(f));
const must = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.base.json', 'apps/web/package.json', 'apps/web/next.config.ts', 'apps/web/app/MindmeApp.tsx', 'packages/core/src/server/env.ts', 'packages/ui/src/styles/tokens.css', 'packages/ui/src/fonts/subset/hangul-common.woff2', 'assets/generated/guide-face-512.png', 'assets/generated/avatar-teen-512.png', 'packages/ui/src/assets/mockup-iphone.png', 'pocs/package.json'];
const envLike = (list) => list.filter((f) => /(^|\/)\.env(\.|$)/.test(f));
const out = {
  totalFiles: files.length,
  uploadedWithVercelignore: up.length,
  uploadedWithoutVercelignore: upBefore.length,
  envFilesWithout: envLike(upBefore),
  envFilesWith: envLike(up),
  mustHaveMissing: must.filter((m) => !up.includes(m)),
  excludedTopDirs: [...new Set(upBefore.filter((f) => !up.includes(f)).map((f) => f.split('/')[0]))],
  pass: envLike(up).length === 0 && must.every((m) => up.includes(m)),
};
await writeFile(`${ROOT}/docs/dev-v1/evidence/gate3r2/critic-behavior-r1-vercelignore.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));

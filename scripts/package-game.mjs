// Zips a game's dist/ folder for upload to YouTube Playables and runs a few
// sanity checks against the Playables requirements.
// Usage: node scripts/package-game.mjs <game-dir>
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const gameDir = resolve(process.argv[2] ?? '.');
const dist = join(gameDir, 'dist');
const pkg = JSON.parse(readFileSync(join(gameDir, 'package.json'), 'utf8'));
const name = basename(pkg.name);

if (!existsSync(join(dist, 'index.html'))) {
  console.error(`No dist/index.html in ${gameDir}. Run the build first.`);
  process.exit(1);
}

const files = [];
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    statSync(p).isDirectory() ? walk(p) : files.push(p);
  }
};
walk(dist);

const ALLOWED = [/^https:\/\/www\.youtube\.com\/game_api\/v1/, /^http:\/\/www\.w3\.org\//];
const problems = [];
let total = 0;
for (const f of files) {
  total += statSync(f).size;
  if (!/\.(html|js|css)$/.test(f)) continue;
  const urls = readFileSync(f, 'utf8').match(/https?:\/\/[^\s"'`)<>]+/g) ?? [];
  for (const u of urls) if (!ALLOWED.some((re) => re.test(u))) problems.push(`${f.slice(dist.length + 1)}: external URL ${u}`);
}
const html = readFileSync(join(dist, 'index.html'), 'utf8');
if (!html.includes('youtube.com/game_api/v1')) problems.push('index.html does not load the Playables SDK');

const MB = 1024 * 1024;
if (total > 30 * MB) problems.push(`bundle is ${(total / MB).toFixed(1)} MB (initial bundle limit is 30 MB)`);

const outDir = join(gameDir, 'release');
mkdirSync(outDir, { recursive: true });
const zip = join(outDir, `${name}-${pkg.version}.zip`);
rmSync(zip, { force: true });
execFileSync('zip', ['-r', '-X', '-q', zip, '.'], { cwd: dist });

console.log(`\n${name} v${pkg.version}: ${files.length} files, ${(total / 1024).toFixed(1)} KB`);
console.log(`→ ${zip}`);
if (problems.length) {
  console.warn('\nPlayables warnings:');
  for (const p of problems) console.warn(`  - ${p}`);
  process.exitCode = 1;
} else {
  console.log('Playables checks passed.');
}

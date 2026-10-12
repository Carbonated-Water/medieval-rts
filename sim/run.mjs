// Runs sim/playtest.ts on the real game code through Vite (no build step).
// npm run playtest -- --hours 6 --seed 1 [--errand 60] [--runs 3] [--json out.json]
import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';

const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : def; };
const opts = { hours: Number(arg('hours', 4)), seed: Number(arg('seed', 1)), errand: Number(arg('errand', 60)), runs: Number(arg('runs', 1)) };
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const { run } = await server.ssrLoadModule('/sim/playtest.ts');
  const started = Date.now();
  const reports = run(opts);
  console.log(`(simulated ${opts.hours}h x ${opts.runs} in ${((Date.now() - started) / 1000).toFixed(1)}s)`);
  const json = arg('json');
  if (json) writeFileSync(json, JSON.stringify(reports, null, 1));
} finally {
  await server.close();
}

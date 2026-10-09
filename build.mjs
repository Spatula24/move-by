#!/usr/bin/env node
/* Rebuilds the Move By app from the City of Boston's Street Sweeping Schedules table.
 *
 *   node build.mjs                  download the latest data from data.boston.gov and build into ./dist
 *   node build.mjs --csv file.csv   build from a CSV you downloaded yourself
 *   node build.mjs --out public     choose the output folder
 *
 * Output: dist/index.html (the whole app, data embedded) and dist/schedule.json (same data on its own,
 * which the page re-fetches while it's open so people don't need to reload).
 * If the data looks wrong the script exits with an error and writes nothing, so a bad day at the
 * source never replaces a good site.
 */
import fs from 'node:fs';
import path from 'node:path';

const RESOURCE = '9fdbdcad-67c8-4b23-b6ec-861e77d56227';
const API = `https://data.boston.gov/api/3/action/datastore_search?resource_id=${RESOURCE}`;
const args = process.argv.slice(2);
const arg = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const outDir = arg('--out') || 'dist';

/* ---- the app's own parsing code, so the build and the page can never disagree ---- */
const template = fs.readFileSync(new URL('./template.html', import.meta.url), 'utf8');
const engine = template.match(/\/\/ <engine>([\s\S]*?)\/\/ <\/engine>/);
if (!engine) throw new Error('template.html has no engine block');
const { parseCSV, compileSchedule } = new Function(engine[1] + '\nreturn { parseCSV, compileSchedule };')();

/* ---- input ---- */
async function getJSON(url) {
  let err;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'move-by-build/1.0 (daily GitHub Actions job)', Accept: 'application/json' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { err = e; await new Promise(res => setTimeout(res, attempt * 3000)); }
  }
  throw new Error('Could not download the City data: ' + err.message);
}
async function loadRecords() {
  const csv = arg('--csv');
  if (csv) return parseCSV(fs.readFileSync(csv, 'utf8'));
  const all = []; let offset = 0;
  for (;;) {
    const j = await getJSON(`${API}&limit=5000&offset=${offset}`);
    if (!j.success) throw new Error('The data API reported failure');
    const recs = j.result.records; all.push(...recs); offset += recs.length;
    if (!recs.length || offset >= j.result.total) break;
  }
  return all;
}

/* ---- build ---- */
const recs = await loadRecords();
const { dists, rows, asOf, streets, dropped, problems } = compileSchedule(recs);
if (problems.length) { console.error('Refusing to publish:\n - ' + problems.join('\n - ')); process.exit(1); }

const built = arg('--built') || new Date().toISOString().slice(0, 10);
const json = JSON.stringify({ built, asOf, dists, rows })
  .replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'schedule.json'), json);
fs.writeFileSync(path.join(outDir, 'index.html'), template.replace('__BUNDLE__', () => json));
fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
console.log(`Built ${rows.length} rules, ${streets} streets, ${dists.length} districts. City data as of ${asOf || 'unknown'}.`);
console.log(`Dropped: ${dropped.otherSide} median/ramp/lane rows, ${dropped.duplicate} duplicates, ${dropped.unparsed} unreadable.`);

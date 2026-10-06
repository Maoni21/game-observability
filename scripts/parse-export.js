'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { classify } = require('../src/classify');

const HEADER = /^(Performance spike|Game completed) (\S+) · (\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2}):(\d{2}) (AM|PM)$/;
const HOUR = 3_600_000;

function naiveLocalMs(m) {
  const [, , , month, day, year, hh, mm, ss, ampm] = m;
  const hour = (Number(hh) % 12) + (ampm === 'PM' ? 12 : 0);
  return Date.UTC(Number(year), Number(month) - 1, Number(day), hour, Number(mm), Number(ss));
}

function readBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  let strayLines = 0;
  let current = null;

  lines.forEach((line, i) => {
    const m = HEADER.exec(line);
    if (m) {
      current = { line: i + 1, kind: m[1], serverId: m[2], local: naiveLocalMs(m), summary: lines[i + 1] ?? '', body: [] };
      blocks.push(current);
    } else if (current && i === current.line) {
      return;
    } else if (current) {
      current.body.push(line);
    } else if (line.trim()) {
      strayLines += 1;
    }
  });

  for (const b of blocks) {
    try {
      b.data = JSON.parse(b.body.join('\n'));
    } catch {
      b.data = null;
    }
  }
  return { lines: lines.length, blocks, strayLines };
}

function deduceOffsetHours(blocks) {
  const diffs = blocks
    .filter((b) => b.data && b.kind === 'Performance spike' && Number.isFinite(b.data.server?.createdAt))
    .map((b) => b.local - b.data.server.createdAt);
  return Math.round(Math.min(...diffs) / HOUR);
}

function parseExport(text) {
  const { lines, blocks, strayLines } = readBlocks(text);
  const valid = blocks.filter((b) => b.data);
  const offsetHours = deduceOffsetHours(valid);

  let outOfOrder = 0;
  for (let i = 1; i < blocks.length; i += 1) {
    if (blocks[i].local > blocks[i - 1].local) outOfOrder += 1;
  }

  const seen = new Map();
  let duplicates = 0;
  let conflictingDuplicates = 0;
  const events = [];

  for (const b of valid) {
    const isSpike = b.kind === 'Performance spike';
    const key = isSpike ? `S:${b.data.report?.id}` : `G:${b.data.id}`;
    const raw = JSON.stringify(b.data);
    if (seen.has(key)) {
      duplicates += 1;
      if (seen.get(key) !== raw) conflictingDuplicates += 1;
      continue;
    }
    seen.set(key, raw);
    const ts = new Date(b.local - offsetHours * HOUR).toISOString();
    events.push(isSpike
      ? { ts, level: 'warn', event: 'perf_spike', category: classify(b.data.report), report: b.data.report, server: b.data.server }
      : { ts, level: 'info', event: 'game_completed', server: b.data });
  }

  events.sort((a, b) => a.ts.localeCompare(b.ts));

  const gaps = [];
  for (let i = 1; i < events.length; i += 1) {
    const minutes = (Date.parse(events[i].ts) - Date.parse(events[i - 1].ts)) / 60_000;
    if (minutes > 60) gaps.push({ from: events[i - 1].ts, to: events[i].ts, minutes: Math.round(minutes) });
  }

  const spikes = events.filter((e) => e.event === 'perf_spike');
  const games = events.filter((e) => e.event === 'game_completed');
  const count = (arr, fn) => arr.reduce((acc, x) => {
    const k = String(fn(x));
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  const stats = {
    lines,
    blocks: blocks.length,
    blocksByKind: count(blocks, (b) => b.kind),
    strayLines,
    invalidJson: blocks.length - valid.length,
    duplicates,
    conflictingDuplicates,
    outOfOrder,
    offsetHours,
    events: events.length,
    firstEvent: events[0]?.ts,
    lastEvent: events.at(-1)?.ts,
    eventsPerDay: count(events, (e) => e.ts.slice(0, 10)),
    gapsOver60min: gaps,
    reportVersions: count(spikes, (e) => e.report.version),
    reportsByBuild: count(spikes, (e) => e.report.build),
    reportsByReason: count(spikes, (e) => e.report.reason),
    reportsByCategory: count(spikes, (e) => e.category),
    suspicious: {
      negativeStage: spikes.filter((e) => Object.values(e.report.work?.stages ?? {}).some((v) => v < 0)).length,
      fpsAbove240: spikes.filter((e) => e.report.fps > 240).length,
      workAboveFrame: spikes.filter((e) => e.report.work?.totalMs > e.report.frameMs + 1).length,
    },
    quarantinedGames: games.filter((e) => e.server.quarantined).length,
  };

  return { events, stats };
}

function main() {
  const input = process.env.EXPORT_IN ?? path.join(__dirname, '..', 'data', 'admin-export-2026-09-20_26.log');
  const output = process.env.EXPORT_OUT ?? path.join(__dirname, '..', 'export', 'export.jsonl');
  const force = process.argv.includes('--force');

  const { events, stats } = parseExport(fs.readFileSync(input, 'utf8'));
  console.log(JSON.stringify(stats, null, 2));

  if (fs.existsSync(output) && !force) {
    console.log(`${output} existe déjà, rien à écrire (--force pour régénérer)`);
    return;
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const tmp = `${output}.tmp`;
  fs.writeFileSync(tmp, events.map((e) => JSON.stringify(e)).join('\n') + '\n');
  fs.renameSync(tmp, output);
  console.log(`${events.length} événements écrits dans ${output}`);
}

if (require.main === module) main();

module.exports = { parseExport };
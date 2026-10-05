'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseExport } = require('../scripts/parse-export');

const spike = (id, createdAt) => JSON.stringify({
  report: { version: 1, id, build: 'beta-20260924-3', reason: 'frame', frameMs: 80, fps: 30, work: { totalMs: 70, stages: { render: 70 } } },
  server: { id: 'abc123XYZ', createdAt },
}, null, 2);

const sample = [
  'Performance spike abc123XYZ · 9/24/2026, 12:05:00 AM',
  'frame · 80ms frame',
  spike('P-0000000a-2', Date.UTC(2026, 8, 23, 22, 0, 0)),
  '',
  'Performance spike abc123XYZ · 9/23/2026, 11:59:00 PM',
  'frame · 80ms frame',
  spike('P-0000000a-1', Date.UTC(2026, 8, 23, 21, 50, 0)),
  '',
  'Performance spike abc123XYZ · 9/23/2026, 11:59:00 PM',
  'frame · 80ms frame',
  spike('P-0000000a-1', Date.UTC(2026, 8, 23, 21, 50, 0)),
  '',
].join('\n');

test("l'export est converti en UTC, trié et dédoublonné", () => {
  const { events, stats } = parseExport(sample);

  assert.equal(stats.blocks, 3);
  assert.equal(stats.duplicates, 1);
  assert.equal(stats.offsetHours, 2);
  assert.equal(events.length, 2);
  assert.equal(events[0].ts, '2026-09-23T21:59:00.000Z');
  assert.equal(events[1].ts, '2026-09-23T22:05:00.000Z');
  assert.equal(events[0].event, 'perf_spike');
});
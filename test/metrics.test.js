'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { once } = require('node:events');
const { createApp } = require('../src/app');

test('GET /metrics expose les métriques au format Prometheus', async () => {
  const app = createApp({ fleet: null, log: () => {} });
  const server = app.listen(0);
  await once(server, 'listening');
  const { port } = server.address();

  try {
    await fetch(`http://localhost:${port}/healthz`);
    const res = await fetch(`http://localhost:${port}/metrics`);
    const body = await res.text();

    assert.strictEqual(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/plain/);
    assert.match(body, /http_requests_total\{method="GET",route="\/healthz",status="200"\} 1/);
  } finally {
    server.close();
  }
});

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { classify } = require('../src/classify');

const base = () => ({
  reason: 'frame',
  phase: 'play',
  fps: 40,
  activities: [],
  work: {
    stages: { world: 3, render: 40 },
    details: { renderOverlay: 2, worldDynamics: 0.2 },
  },
});

test('un rapport sans signature particulière est classé rendu', () => {
  assert.equal(classify(base()), 'rendu');
});

test('chaque signature donne sa catégorie', () => {
  const overlay = base();
  overlay.work.details.renderOverlay = 400;
  assert.equal(classify(overlay), 'overlay');

  const shader = base();
  shader.phase = 'warmup';
  assert.equal(classify(shader), 'shader');

  const hidden = base();
  hidden.activities = [{ name: 'visibilityHidden', durationMs: 3000 }];
  assert.equal(classify(hidden), 'onglet-cache');

  const network = base();
  network.reason = 'network';
  assert.equal(classify(network), 'reseau');

  const world = base();
  world.work.details.worldDynamics = 120;
  assert.equal(classify(world), 'monde');
});

test('un rapport impossible est classé falsifie avant tout le reste', () => {
  const fake = base();
  fake.fps = 1200;
  fake.work.details.renderOverlay = 400;
  assert.equal(classify(fake), 'falsifie');

  const negative = base();
  negative.work.stages.render = -38.4;
  assert.equal(classify(negative), 'falsifie');
});

test('un rapport incomplet ne fait pas planter la classification', () => {
  assert.equal(classify({ id: 'P-0000000a-1' }), 'rendu');
  assert.equal(classify(undefined), 'rendu');
});

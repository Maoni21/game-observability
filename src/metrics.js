'use strict';

const client = require('prom-client');

const register = new client.Registry();

client.collectDefaultMetrics({ register });

const httpRequests = new client.Counter({
    name: 'http_requests_total',
    help: 'Nombre de requêtes HTTP reçues',
    labelNames: ['method', 'route', 'status'],
    registers: [register],
  });

 const httpDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Durée de traitement des requêtes HTTP',
    labelNames: ['method', 'route'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
    registers: [register],
});

const perfReports = new client.Counter({
    name: 'perf_reports_total',
    help: 'Rapports de performance reçus',
    labelNames: ['reason', 'build', 'source'],
    registers: [register],
});

const gamesCompleted = new client.Counter({
    name: 'games_completed_total',
    help: 'Nombre de parties terminées',
    labelNames: ['map'],
    registers: [register],
});

function createGamesInProgressGauge(fleet) {
    return new client.Gauge({
      name: 'games_in_progress',
      help: 'Nombre de parties en cours',
      registers: [register],
      collect() {
        this.set(fleet ? fleet.liveGames().length : 0);
      },
    });

const KNOWN_REASONS = new Set(['frame', 'network']); // à compléter !
const BUILD_FORMAT = /^beta-\d{8}-\d+$/;

const safeReason = (r) => (KNOWN_REASONS.has(r) ? r : 'other');
const safeBuild = (b) => (typeof b === 'string' && BUILD_FORMAT.test(b) ? b : 'invalid');

module.exports = {
  register,
  httpRequests,
  httpDuration,
  perfReports,
  gamesCompleted,
  createGamesInProgressGauge,
  safeReason,
  safeBuild,
};}

const KNOWN_REASONS = new Set(['frame', 'network']); // à compléter !
const BUILD_FORMAT = /^beta-\d{8}-\d+$/;

const safeReason = (r) => (KNOWN_REASONS.has(r) ? r : 'other');
const safeBuild = (b) => (typeof b === 'string' && BUILD_FORMAT.test(b) ? b : 'invalid');

module.exports = {
  register,
  httpRequests,
  httpDuration,
  perfReports,
  gamesCompleted,
  createGamesInProgressGauge,
  safeReason,
  safeBuild,
};
'use strict';

const CATEGORIES = ['falsifie', 'onglet-cache', 'reseau', 'shader', 'overlay', 'monde', 'rendu'];

function classify(report) {
  const stages = report?.work?.stages ?? {};
  const details = report?.work?.details ?? {};
  const activities = report?.activities ?? [];

  if (report?.fps > 240 || Object.values(stages).some((v) => v < 0)) return 'falsifie';
  if (activities.some((a) => a.name === 'visibilityHidden')) return 'onglet-cache';
  if (report?.reason === 'network') return 'reseau';
  if (report?.phase === 'warmup') return 'shader';
  if (details.renderOverlay > 100) return 'overlay';
  if (details.worldDynamics > 50) return 'monde';
  return 'rendu';
}

module.exports = { classify, CATEGORIES };

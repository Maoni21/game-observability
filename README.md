# game-observability

Observabilité et détection de comportements sur un jeu multijoueur web.

Le projet répond à deux questions :

- Pourquoi des joueurs ont des saccades depuis jeudi soir, et qui est touché ?
- Est-ce que quelqu'un abuse du jeu ?

Les réponses sont dans [`docs/postmortem.md`](docs/postmortem.md).

## Lancer le projet

Il faut Docker et Docker Compose.

```bash
git clone https://github.com/Maoni21/game-observability.git
cd game-observability
docker compose up -d --build
```

Cette commande lance le service du jeu, le générateur de charge, le traitement de l'export, Prometheus, Loki, Alloy et Grafana.

Au premier lancement, attendre 2 minutes puis lancer :

```bash
curl -X POST localhost:3100/flush
```

Pour tout arrêter : `docker compose down`. Pour tout remettre à zéro : `docker compose down -v`.

## Adresses

- Grafana : http://localhost:3000, puis Dashboards → Game telemetry
- Prometheus : http://localhost:9090
- Service du jeu : http://localhost:8080/healthz

## Dashboards

- **Santé du service** : le service fonctionne-t-il bien ?
- **Performance côté joueur** : pourquoi des saccades, et qui est touché ?
- **Activité de jeu et intégrité des parties** : quelqu'un abuse-t-il du jeu ?

Les dashboards 2 et 3 s'ouvrent sur la semaine de l'export. Le menu **Source** permet de passer sur les données en direct.

## Tests

```bash
npm ci
npm test
npm run lint
```

La CI GitHub Actions lance le lint, les tests, construit l'image Docker, l'analyse avec Trivy et la publie sur `ghcr.io`.

## Documentation

- [`docs/qualite.md`](docs/qualite.md) : qualité des données de l'export
- [`docs/metriques.md`](docs/metriques.md) : métriques exposées par le service
- [`docs/metriques-vs-logs.md`](docs/metriques-vs-logs.md) : ce qui va dans les métriques et ce qui va dans les logs
- [`docs/enquete.md`](docs/enquete.md) : types de rapports et comportements anormaux
- [`docs/alertes.md`](docs/alertes.md) : règles d'alerte et seuils
- [`docs/postmortem.md`](docs/postmortem.md) : rapport d'incident

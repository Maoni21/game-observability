# Métriques ou logs : qui fait quoi

## La règle

- **Une métrique répond à « combien ? »** : un nombre agrégé, peu coûteux, disponible en temps réel. On l'utilise pour la santé du service et les alertes de disponibilité.
- **Un log répond à « lequel ? » et « pourquoi ? »** : chaque événement avec tout son détail. On l'utilise pour enquêter et pour détecter des comportements.

## Dans cette architecture

| Besoin | Outil | Pourquoi |
|---|---|---|
| Débit, erreurs et latence de l'API (RED) | Prometheus | Compteurs et histogramme agrégés à chaque scrape, idéaux pour des alertes rapides (`ServiceIndisponible`, `LatenceApiElevee`) |
| Parties en cours, parties terminées par carte | Prometheus | Une seule valeur ou quelques séries, tendance en direct |
| Rapports par cause et par build | Prometheus **et** Loki | La métrique donne la tendance live à faible coût, le log permet de descendre au rapport précis |
| Quel écran, quel navigateur, quel client, quelle partie | Loki | Valeurs illimitées (identifiants, résolutions, navigateurs) : interdites en label Prometheus, elles restent dans le corps JSON du log |
| Export historique du 19 au 26 septembre | Loki | Prometheus n'accepte pas facilement des données passées, Loki les ingère avec leur vrai horodatage |
| Détection d'abus (farming, rapports falsifiés) | Loki (ruler) | Il faut lire le contenu des événements (score, carte, fps) |

## Cardinalité

- Labels Prometheus : `method`, `route`, `status`, `reason`, `build`, `source`, `map`. Chacun a un petit nombre de valeurs, filtrées par `safeReason`, `safeBuild` et `safeMap`.
- Labels Loki : `service`, `origin`, `level`, `event`, soit moins de 20 flux au total.
- Tout le reste (`report.id`, `server.id`, `width`, `browser`, `score`, `category`) est extrait au moment de la requête avec `| json`, sans jamais créer de flux.

## Exemple sur la question de la direction

1. La métrique montre que les rapports augmentent sur le build `beta-20260924-3` (`build_reason:perf_reports:rate5m`).
2. Les logs montrent pourquoi : `renderOverlay` dépasse 200 ms.
3. Les logs montrent aussi qui est touché : les écrans de 2560 px et plus avec le bloom activé.

La métrique donne l'alerte, le log apporte l'explication.

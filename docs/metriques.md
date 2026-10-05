# Métriques exposées par le service

| Métrique | Type | Labels | Question à laquelle elle répond |
|---|---|---|---|
| `http_requests_total` | Counter | method, route, status | Combien de requêtes par seconde, et quelle part en erreur ? (Rate, Errors) |
| `http_request_duration_seconds` | Histogram | method, route | Combien de temps prend une requête, au p50, p95, p99 ? (Duration) |
| `perf_reports_total` | Counter | reason, build, source | Combien de rapports de saccades, pour quelle cause et sur quelle version ? |
| `games_in_progress` | Gauge | aucun | Combien de parties tournent en ce moment ? |
| `games_completed_total` | Counter | map | Combien de parties se terminent, sur quelle carte ? |

## Choix des types

- Counter pour tout ce qui s'accumule : le débit s'obtient avec `rate()`, et le compteur résiste aux redémarrages.
- Gauge pour une valeur instantanée qui monte et descend.
- Histogram pour les durées : il permet de calculer des percentiles agrégés sur plusieurs instances, ce qu'un Summary ne permet pas.

## Choix des labels et cardinalité

| Label | Valeurs possibles | Protection |
|---|---|---|
| method | GET, POST | aucune nécessaire |
| route | modèle de route Express (`/api/reports`…) ou `unmatched` | l'URL brute n'est jamais utilisée |
| status | quelques codes HTTP | aucune nécessaire |
| reason | `frame`, `network`, sinon `other` | `safeReason` |
| build | format `beta-AAAAMMJJ-N`, sinon `invalid` | `safeBuild` |
| source | `api` ou `fleet` | valeur fixée par le code |
| map | quelques cartes, sinon `unknown` | `safeMap` |

Labels refusés : identifiant de partie, identifiant de rapport, navigateur, GPU. Ils ont un nombre de valeurs non borné. Ces informations restent disponibles dans les logs (Loki), qui sont faits pour ce niveau de détail.

Les champs `reason` et `build` viennent du client, donc ils peuvent être falsifiés. Sans filtrage, un client malveillant pourrait créer autant de séries qu'il le souhaite et saturer Prometheus.
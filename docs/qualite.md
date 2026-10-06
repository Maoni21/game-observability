# Rapport de qualité de l'export historique

Fichier analysé : `data/admin-export-2026-09-20_26.log`. Les statistiques complètes sont dans `docs/qualite-export.json`, généré par `scripts/parse-export.js`.

Deux types de preuves :

- **Shell** : commandes sur le fichier brut, avant tout traitement.
- **LogQL** : requêtes dans Grafana Explore, datasource Loki, période du 2026-09-19 22:00 au 2026-09-27 00:00 UTC, type de requête Instant. `[$__range]` couvre toute la période.

## 1. Volumétrie

| Constat | Chiffre | Preuve |
|---|---|---|
| Lignes brutes | 264 344 | `wc -l data/admin-export-2026-09-20_26.log` |
| Blocs « Performance spike » | 2 148 | `grep -c '^Performance spike ' data/admin-export-2026-09-20_26.log` |
| Blocs « Game completed » | 796 | `grep -c '^Game completed ' data/admin-export-2026-09-20_26.log` |
| Événements après nettoyage | 2 889 (2 110 rapports, 779 parties) | `sum by (event) (count_over_time({service="game-telemetry", origin="export"} [$__range]))` |
| Rapports par build | 0919-2 : 641, 0922-1 : 625, 0924-3 : 648, 0926-5 : 171, 0926-6 : 25 | `sum by (build) (count_over_time({service="game-telemetry", origin="export", event="perf_spike"} \| json build="report.build" [$__range]))` |
| Rapports par raison | frame : 2 018, network : 92 | `sum by (reason) (count_over_time({service="game-telemetry", origin="export", event="perf_spike"} \| json reason="report.reason" [$__range]))` |

Événements par jour (UTC) : 19/09 : 19, 20/09 : 397, 21/09 : 334, 22/09 : 345, 23/09 : 426, 24/09 : 414, 25/09 : 502, 26/09 : 452.

Preuve, en type Range avec un pas de 1d : `sum(count_over_time({service="game-telemetry", origin="export"} [1d]))`.

## 2. Anomalies de format

| Anomalie | Chiffre | Preuve | Traitement |
|---|---|---|---|
| Format multi-lignes : un en-tête, une ligne de résumé, puis un JSON indenté sur plusieurs lignes | 2 944 blocs sur 264 344 lignes | `head -20 data/admin-export-2026-09-20_26.log` | Le parser découpe les blocs et produit une ligne JSON par événement (`export/export.jsonl`) |
| Dates américaines au format 12 h, sans fuseau (`9/27/2026, 12:04:13 AM`) | tous les blocs | `grep -m3 -E '^(Performance spike\|Game completed) ' data/admin-export-2026-09-20_26.log` | Conversion en ISO 8601 UTC |
| Piège de minuit : `12:xx AM` vaut 00:xx, pas 12:xx | 100 en-têtes | `grep -cE '12:[0-9]{2}:[0-9]{2} AM$' data/admin-export-2026-09-20_26.log` | `heure % 12`, plus 12 si PM |
| Heures locales en UTC+2, sans que ce soit écrit | décalage de 2 h | premier rapport : en-tête `9/20/2026, 12:31:37 AM`, `server.createdAt` = `node -e "console.log(new Date(1789857032483).toISOString())"`, soit 2026-09-19T22:30:32Z, 2 h plus tôt | Décalage déduit automatiquement (`offsetHours: 2`) et soustrait |
| Le nom du fichier annonce du 20 au 26, en heure locale | en UTC : du 19/09 22:31 au 26/09 22:04 | 19 événements le 19/09 : `sum(count_over_time({service="game-telemetry", origin="export"} [1d]))` à l'instant 2026-09-20 00:00 UTC | Toutes les analyses sont faites en UTC |
| Fichier trié du plus récent au plus ancien | premier bloc : 27/09 00:04 (local), dernier : 20/09 00:31 | `grep -E '^(Performance spike\|Game completed) ' data/admin-export-2026-09-20_26.log \| head -1` puis `\| tail -1` | Tri chronologique avant l'ingestion |
| Blocs qui ne respectent pas cet ordre | 2 | `outOfOrder` dans `qualite-export.json` | Corrigé par le tri |
| Deux versions du schéma de rapport | v1 : 2 085, v2 : 25 | `sum by (v) (count_over_time({service="game-telemetry", origin="export", event="perf_spike"} \| json v="report.version" [$__range]))` | voir la ligne suivante |
| En v2, `rttMs` passe de `report.rttMs` à `report.network.rttMs` (tous les v2 sont sur `beta-20260926-6`) | 25 rapports sans `report.rttMs` | `sum(count_over_time({service="game-telemetry", origin="export", event="perf_spike"} \| json r="report.rttMs" \| r="" [$__range]))` | Les dashboards lisent les deux champs |
| JSON invalide, lignes hors bloc | 0 et 0 | `invalidJson` et `strayLines` dans `qualite-export.json` | aucun |

## 3. Doublons

55 blocs apparaissent deux fois : 38 rapports et 17 parties. Tous sont des copies exactes, sans aucun conflit (`conflictingDuplicates: 0`).

| Preuve | Résultat |
|---|---|
| `grep -oE '"id": "P-[0-9a-f]{8}-[0-9]+"' data/admin-export-2026-09-20_26.log \| sort \| uniq -d \| wc -l` | 38 |
| `grep -A3 '^Game completed' data/admin-export-2026-09-20_26.log \| grep -oE '"id": "[A-Za-z0-9]{9}"' \| sort \| uniq -d \| wc -l` | 17 |

Traitement : dédoublonnage par `report.id` pour les rapports et par `server.id` pour les parties. Vérification : 2 944 − 55 = 2 889, soit exactement le total compté dans Loki.

## 4. Trous

10 intervalles de plus de 60 minutes sans aucun événement (liste dans `gapsOver60min`). Neuf tombent la nuit, entre 23:30 et 04:40 UTC, soit entre 01:30 et 06:40 heure locale. C'est la baisse normale d'activité nocturne.

Un seul trou est anormal : **le 22/09, de 11:59 à 14:14 UTC (135 minutes), en pleine journée.**

| Fenêtre de 2 h (12:00 à 14:00 UTC) | Événements | Preuve : `sum(count_over_time({service="game-telemetry", origin="export"} [2h]))`, requête Instant à 14:00 UTC |
|---|---|---|
| 21/09 | 18 | instant 2026-09-21 14:00 UTC |
| **22/09** | **0** | instant 2026-09-22 14:00 UTC |
| 23/09 | 38 | instant 2026-09-23 14:00 UTC |

Interprétation : des parties ont lieu juste avant et juste après, donc il s'agit très probablement d'une coupure de la collecte ou de l'export, pas d'une absence de joueurs. Ces données sont perdues et ne peuvent pas être reconstituées.

## 5. Incohérences

| Incohérence | Chiffre | Preuve |
|---|---|---|
| Étape de rendu au temps négatif | 70 | `sum(count_over_time({service="game-telemetry", origin="export", event="perf_spike"} \| json render="report.work.stages.render" \| render < 0 [$__range]))` |
| fps supérieurs à 240 (les autres rapports ne dépassent jamais 144) | 48, tous parmi les 70 précédents | `... \| json fps="report.fps" \| fps > 240 [$__range]` |
| Temps de travail supérieur à la durée de l'image (`work.totalMs > frameMs`) | 70, exactement les mêmes rapports | `workAboveFrame` dans `qualite-export.json` |
| Client unique derrière ces 70 rapports | `5e1f0c7a` | `sum by (client) (count_over_time({service="game-telemetry", origin="export", event="perf_spike"} \| json category \| category="falsifie" \| regexp `"id":\s*"P-(?P<client>[0-9a-f]{8})` [$__range]))` |
| Parties mises en quarantaine par le serveur | 17 | `sum(count_over_time({service="game-telemetry", origin="export", event="game_completed"} \| json q="server.quarantined" \| q="true" [$__range]))` |

Traitement : ces rapports ne sont **pas supprimés**, pour qu'on puisse toujours les détecter. Ils sont classés `falsifie` par `src/classify.js` et exclus des analyses de performance.

## 6. Récapitulatif des traitements

| Problème | Traitement | Où |
|---|---|---|
| Multi-lignes | découpage en blocs, une ligne JSON par événement | `scripts/parse-export.js` |
| Date en 12 h, minuit, fuseau | conversion UTC, décalage déduit de `createdAt` | `scripts/parse-export.js` |
| Ordre inversé | tri chronologique | `scripts/parse-export.js` |
| Doublons | dédoublonnage par identifiant | `scripts/parse-export.js` |
| Schéma v1/v2 | lecture des deux emplacements de `rttMs` | dashboard « Performance côté joueur » |
| Rapports falsifiés | catégorie `falsifie`, conservés | `src/classify.js` |
| Horodatage dans Loki | horodatage de l'événement, pas de l'ingestion | `alloy/config.alloy` (`stage.timestamp`) |
| Données anciennes acceptées | `reject_old_samples: false` | `loki/loki-config.yml` |

## 7. Limites

- La rétention de Loki est de 30 jours : les données de l'export seront supprimées vers le 19 octobre.
- Les horodatages sont à la seconde : deux événements de la même seconde gardent leur ordre d'export.
- Le trou du 22/09 ne peut pas être comblé.
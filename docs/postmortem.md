# Postmortem : saccades depuis le jeudi 24 septembre et abus du jeu

Toutes les heures sont en heure locale (UTC+2), celle des joueurs. Source : export du 20 au 27 septembre ingéré dans Loki.

## Résumé

1. **Saccades** : le build `beta-20260924-3`, déployé le jeudi 24 au soir, fait exploser le temps de rendu de l'overlay. Seuls les joueurs avec un écran de 2560 px ou plus **et** le bloom activé sont touchés. Les deux builds suivants n'ont pas corrigé le problème.
2. **Abus** : oui, deux abus distincts. Du farming de victoires 3-0 sur la carte vault pendant deux nuits, et un client qui falsifie ses rapports de performance.

## Partie 1 : les saccades

### Impact

- 253 rapports de saccades dus à l'overlay sur `beta-20260924-3` et les builds suivants, contre 9 sur toute la période précédente.
- Part des rapports venant de l'overlay : 29 % sur `beta-20260924-3`, 34,5 % sur `beta-20260926-5`, 16 % sur `beta-20260926-6`, contre moins de 1 % avant.
- 44 clients différents ont envoyé au moins un rapport overlay.
- Une image saccadée dure alors de 260 à 690 ms (médiane 490 ms) : le jeu se fige visiblement.

### Population touchée

Écrans de 2560 px de large ou plus avec le bloom activé : 249 rapports overlay sur 262 (95 %). Répartition : 2560 px : 105, 3840 px : 89, 3440 px : 55. Tous les navigateurs sont touchés. Les autres joueurs ne voient aucune différence.

### Chronologie

| Quand | Quoi |
|---|---|
| mardi 22/09, 12:10 | Déploiement de `beta-20260922-1`, sans effet sur l'overlay |
| jeudi 24/09, 09:35 | Premiers rapports en `beta-20260924-3`, tous du client falsificateur (voir partie 2) |
| **jeudi 24/09, vers 19:00** | **Début du déploiement de `beta-20260924-3` aux joueurs** |
| **jeudi 24/09, 20:16** | **Premier rapport overlay > 100 ms, début des plaintes** |
| vendredi 25/09 | `beta-20260924-3` devient majoritaire (410 rapports contre 3), 114 rapports overlay dans la journée |
| samedi 26/09, 12:32 | Déploiement de `beta-20260926-5` : le problème persiste (34,5 %) |
| samedi 26/09, 20:50 | Déploiement de `beta-20260926-6` (nouveau format de rapport v2) : le problème persiste (16 %) |
| dimanche 27/09, 00:04 | Fin de l'export, toujours sans correctif |

### Cause

Une modification du rendu de l'overlay dans `beta-20260924-3`, dont le coût explose quand deux conditions sont réunies : très grande résolution et passe de bloom. Ce n'est ni le réseau ni le serveur : sur les rapports overlay, le RTT médian (35 ms) et l'écart maximal entre ticks serveur (52 ms au plus) sont identiques aux autres rapports.

### Pourquoi on ne l'a pas vu plus tôt

Il n'existait ni métriques, ni logs centralisés, ni alertes. Les seules sources étaient les plaintes des joueurs et un export manuel de la console d'administration.

### Preuves

Rapports overlay par build :

```logql
sum by (build) (count_over_time({service="game-telemetry", origin="export", event="perf_spike"} | json build="report.build", o="report.work.details.renderOverlay" | o > 100 [$__range]))
```

Population touchée :

```logql
sum by (width, bloom) (count_over_time({service="game-telemetry", origin="export", event="perf_spike"} | json o="report.work.details.renderOverlay", width="report.graphics.width", bloom="report.graphics.bloom" | o > 100 [$__range]))
```

Captures : `enquete-1-builds.png`, `enquete-2-overlay.png`, `enquete-3-overlay.png`, `dashboard-perf.png` (panneaux « Quel build provoque des saccades dues à l'overlay ? » et « Quels écrans sont touchés ? »).

### Actions

| Type | Action |
|---|---|
| Corrective immédiate | Revenir à `beta-20260922-1`, ou désactiver le bloom par défaut au-dessus de 2560 px en attendant le correctif |
| Corrective | Corriger le rendu de l'overlay et vérifier que sa part retombe sous 1 % |
| Préventive | Déploiement progressif (canary) bloqué automatiquement si `RegressionOverlay` se déclenche |
| Préventive | Test de performance avant chaque build sur une configuration 4K avec bloom |
| Préventive | Garder dashboards et alertes en place : une régression est alors détectée en une vingtaine de minutes au lieu de plusieurs jours |

## Partie 2 : les abus

### Farming de victoires

- **Quoi** : 83 parties gagnées 3-0 sur la carte vault en moins de 3 minutes chacune, alors qu'une partie normale dure de 3 à 14 minutes.
- **Quand** : deux épisodes nocturnes. Mercredi 23/09 de 01:14 à 03:46 (45 parties), puis vendredi 25/09 de 00:44 à 02:32 (38 parties).
- **Réaction de l'anti-triche** : seulement 17 parties sur 83 mises en quarantaine (20 %).
- **Preuve** : la part des parties 3-0 sur vault, normalement d'environ 3 %, approche 100 % pendant ces deux nuits.

```logql
sum(count_over_time({service="game-telemetry", origin="export", event="game_completed"} |~ `"score":\s*\[3,\s*0\]` | json map="server.map" | map="vault" [1h]))
/
sum(count_over_time({service="game-telemetry", origin="export", event="game_completed"} [1h]))
```

Captures : `enquete-4-overlay.png`, `enquete-5-durees..png`, `dashboard-integrite.png`.

### Rapports falsifiés

- **Quoi** : le client `5e1f0c7a` envoie 70 rapports impossibles : étape de rendu négative (jusqu'à -101 ms), fps de 240 à 1 200 alors que l'image dure environ 55 ms, temps de travail supérieur à la durée de l'image.
- **Quand** : du jeudi 24/09 à 09:35 au samedi 26/09 à 22:37, toujours en `beta-20260924-3`, avec le même profil (Safari sur Mac, 1366 px de large).
- **Risque** : ces rapports faussent les statistiques de performance, et le client teste peut-être l'API d'ingestion.
- **Preuve** :

```logql
sum by (client) (count_over_time({service="game-telemetry", origin="export", event="perf_spike"} | json category | category="falsifie" | regexp `"id":\s*"P-(?P<client>[0-9a-f]{8})` [$__range]))
```

Résultat : `5e1f0c7a` : 70. Capture : `dashboard-integrite.png`.

### Actions

| Type | Action |
|---|---|
| Corrective | Annuler les victoires des 83 parties suspectes et examiner les comptes concernés |
| Corrective | Bloquer le client `5e1f0c7a` et exclure ses 70 rapports des statistiques (déjà fait grâce à la catégorie `falsifie`) |
| Préventive | Validation des rapports côté serveur : refuser fps > 240, étapes négatives, temps de travail supérieur à l'image |
| Préventive | Anti-triche renforcé : durée minimale de partie, répétition du même score sur la même carte |
| Préventive | Alertes `FarmingSuspecte` et `RapportsFalsifies` actives sur le flux live |

## Leçons

- Sans observabilité, une régression qui touche une petite population passe inaperçue pendant des jours.
- Un export manuel est un mauvais outil d'enquête : fuseau implicite, doublons, trou de 2 h 15 le 22/09 (voir `qualite.md`).
- Reste à faire : l'export ne contient pas les identifiants de comptes, on ne peut donc pas dire combien de joueurs différents ont fait du farming.

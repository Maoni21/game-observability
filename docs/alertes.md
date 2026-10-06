# Règles d'alerte

Deux moteurs évaluent les règles :

- **Prometheus** surveille la santé du service, à partir des métriques.
- **Le ruler de Loki** surveille les comportements des joueurs, à partir des logs.

Les règles Loki s'évaluent sur les dernières minutes. Elles se déclenchent donc sur le flux live, pas sur l'export du 20 au 26 septembre, qui est trop ancien. Sur l'export, les mêmes conditions ont été vérifiées par des requêtes sur toute la période (voir `enquete.md`).

## Alertes Prometheus (santé du service)

| Alerte | Condition | Pendant | Sévérité |
|---|---|---|---|
| ServiceIndisponible | `up{job="game-telemetry"} == 0` | 1 min | critical |
| TauxErreursApiEleve | part de réponses 5xx sur `/api/reports` > 5 % | 5 min | warning |
| LatenceApiElevee | p95 de `/api/reports` > 100 ms | 10 min | warning |
| BuildsInvalidesRecus | rapports avec un build au format inconnu > 0 | 5 min | info |

### Justification des seuils

- **ServiceIndisponible, 1 min** : Prometheus lit `/metrics` toutes les 15 s. Avec 1 minute, il faut 4 échecs d'affilée, donc un échec isolé ne déclenche rien.
- **TauxErreursApiEleve, 5 %** : en temps normal, le service ne renvoie aucune 5xx. Les 3 % de corps invalides envoyés par le loadgen reçoivent une 400, qui n'est pas comptée. 5 % pendant 5 minutes signale une vraie panne, pas une erreur ponctuelle.
- **LatenceApiElevee, 100 ms** : le p95 normal est de quelques millisecondes. 100 ms correspond exactement à une frontière de bucket de l'histogramme, donc le percentile calculé est précis à ce seuil. La durée de 10 minutes absorbe les rafales du loadgen (80 requêtes/s pendant 20 s toutes les 2 min).
- **BuildsInvalidesRecus, > 0** : un client officiel envoie toujours un build au format `beta-AAAAMMJJ-N`. Un build mal formé signale un client modifié ou des rapports forgés. La sévérité est `info`, car c'est un signal à examiner, pas une panne.

## Alertes Loki (comportements)

| Alerte | Condition | Fenêtre | Pendant | Sévérité |
|---|---|---|---|---|
| RegressionOverlay | part des rapports d'un build avec `renderOverlay` > 100 ms supérieure à 10 % | 15 min | 5 min | critical |
| FarmingSuspecte | part des parties 3-0 sur vault supérieure à 25 %, avec plus de 5 parties de ce type | 1 h | 10 min | warning |
| RapportsFalsifies | au moins 3 rapports impossibles (fps > 240 ou rendu négatif) pour un même client | 1 h | immédiat | warning |

### Justification des seuils

- **RegressionOverlay, 10 %** : avant le build `beta-20260924-3`, l'overlay ne cause presque aucun rapport (moins de 1 %). Après la régression, il en cause plus de 10 % (190 rapports sur ce build, contre 9 sur tous les builds précédents). 10 % se situe entre les deux. La règle est calculée par build : l'alerte indique directement la version fautive.
- **FarmingSuspecte, 25 % et plus de 5 parties** : en jeu normal, une partie 3-0 sur vault représente environ 3 % des parties terminées. Pendant les nuits du 22 au 23 et du 24 au 25 septembre, ces parties dominaient (83 parties 3-0 sur vault en moins de 3 minutes). Le minimum de 6 parties évite de déclencher sur une heure creuse, où 1 partie sur 3 suffirait à dépasser 25 %.
- **RapportsFalsifies, 3 rapports** : un rendu ne peut pas durer moins de 0 ms, et les rapports légitimes de l'export ne dépassent jamais 144 fps. Le client `5e1f0c7a` a envoyé 70 rapports de ce type. Le seuil de 3 ignore un rapport isolé, qui pourrait venir d'un bug d'horloge.

## Faux positifs et faux négatifs

| Alerte | Faux positif possible | Faux négatif possible |
|---|---|---|
| ServiceIndisponible | redémarrage volontaire de plus d'1 minute (déploiement) | si Prometheus lui-même tombe, personne n'est alerté |
| TauxErreursApiEleve | trafic très faible : 1 erreur sur 10 requêtes fait 10 % | les erreurs 4xx (rapports mal formés) ne sont pas comptées |
| LatenceApiElevee | lenteur passagère de la machine hôte | une route lente autre que `/api/reports` n'est pas surveillée |
| BuildsInvalidesRecus | build de développement au nom non standard | un tricheur qui recopie un vrai numéro de build passe inaperçu |
| RegressionOverlay | build avec très peu de rapports : 1 rapport overlay sur 3 fait 33 % | régression qui touche une petite population (écrans 2560 px et plus avec bloom), diluée sous 10 % ; régression sur une autre étape du rendu |
| FarmingSuspecte | équipe forte qui gagne légitimement plusieurs fois en 3-0 | farming réparti sur d'autres cartes, avec des scores 3-1, ou étalé dans le temps sous 25 % |
| RapportsFalsifies | écran à 360 Hz réellement au-dessus de 240 fps | falsificateur qui envoie des valeurs plausibles, ou qui change d'identifiant client à chaque rapport |

## Preuves

Sur le flux live (simulation et loadgen), deux détections sont en firing :

- **RegressionOverlay** : le loadgen envoie environ 20 % de rapports overlay sur le build `beta-20260926-6`, au-dessus du seuil de 10 %.
- **FarmingSuspecte** : la simulation produit des rafales de parties 3-0 sur vault.

RapportsFalsifies reste en normal : aucun client live n'envoie de rapport impossible.

![Alertes en firing](captures/alertes-firing.png)

![Liste des 11 règles](captures/alertes-regles.png)

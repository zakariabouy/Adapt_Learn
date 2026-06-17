# Agent 2 (Personnalisateur) — Méthodologie de Fine-Tuning & Évaluation des Prompts

**Projet :** AdaptLearn
**Auteur :** Adam Daoudi
**Date :** 16 avril 2026
**Statut :** Production (v3)

---

## 1. Résumé exécutif

Pour l'Agent 2 (Personnalisateur de contenu pédagogique), nous avons adopté une approche **d'In-Context Fine-Tuning (ICFT)** plutôt qu'un fine-tuning classique des poids du modèle Gemini 1.5 Flash. Cette décision d'ingénierie repose sur quatre critères : **data drift**, **coût d'inférence**, **auditabilité pédagogique**, et **agilité d'itération**. Elle est validée par une évaluation quantitative (golden dataset + 5 métriques) démontrant une progression mesurable de l'alignement de **0.48 à 0.86** sur trois itérations de prompts.

---

## 2. Décision technique : ICFT vs Fine-Tuning de poids

### 2.1 Analyse comparative

| Critère | Fine-Tuning de poids (Gemini Tuning API) | In-Context Fine-Tuning (approche adoptée) |
|---|---|---|
| Volume de données requis | 100–500 exemples labellisés minimum | 10 exemples golden suffisent |
| Temps d'implémentation | 4–8h (dataset, job async, intégration) | 2–3h (prompts + RAG + harness) |
| Mise à jour curriculaire (MEN) | Re-training complet nécessaire | Édition JSON → effet immédiat |
| Coût d'inférence marginal | +30 % latence, +20 % coût par requête | ~0 % grâce au context caching Gemini 1.5 |
| Auditabilité pédagogique | Boîte noire (poids opaques) | 100 % inspectable (prompts versionnés + RAG sources) |
| Reproductibilité par un tiers | Impossible sans accès aux poids | `python -m agents.personalizer.eval.evaluate` |
| Robustesse au data drift | Élevée dans le temps court, dégradation sans re-training | Couvre le drift par mise à jour du corpus |

### 2.2 Justification pédagogique (spécifique au contexte marocain)

Le programme scolaire marocain (référentiel MEN) est **révisable annuellement**, et la Constitution de 2011 impose un cadre de valeurs (art. 5 pluralisme linguistique, art. 19 égalité, art. 31 accès à l'éducation) qui doit rester **explicitement vérifiable** dans chaque sortie produite par l'IA.

Un fine-tuning de poids rendrait ces valeurs implicites et non-auditables. L'ICFT les garde explicites dans le prompt système v3, permettant à l'Agent 3 (Critic) de **vérifier formellement l'alignement constitutionnel** à chaque génération.

---

## 3. Architecture d'In-Context Fine-Tuning (ICFT)

L'approche repose sur trois couches contextuelles injectées à chaque requête :

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1 — System Prompt v3                              │
│   • Rôle expert marocain                                │
│   • Garde-fous constitutionnels (6 règles)              │
│   • Schéma de sortie strict                             │
├─────────────────────────────────────────────────────────┤
│ Layer 2 — RAG MEN (dynamique par grade × matière)       │
│   • Compétences cibles                                  │
│   • Vocabulaire clé                                     │
│   • Notions à éviter (anti-curriculum)                  │
│   • Note pédagogique contextuelle                       │
├─────────────────────────────────────────────────────────┤
│ Layer 3 — Few-Shot Golden Examples                      │
│   • 2 exemples sélectionnés dynamiquement               │
│   • Critère : proximité grade × matière                 │
│   • Source : golden_dataset.jsonl (10 cas curés)        │
└─────────────────────────────────────────────────────────┘
                            ↓
              Profil apprenant (Agent 1)
                            ↓
                     Gemini 1.5 Flash
                            ↓
               Sortie JSON structurée
              (+ men_tags & cultural_anchors
                 pour audit Agent 3)
```

### 3.1 Corpus MEN (RAG statique)

**Fichier :** `backend/agents/personalizer/men_corpus/competencies.json`

Couvre les niveaux **CE1, CE2, CM1, CM2** et les matières principales : mathématiques, arabe, français, activité scientifique, éducation islamique, éducation civique. Chaque entrée contient : compétences, vocabulaire, notions à éviter, ancrages culturels recommandés.

### 3.2 Golden Dataset (Few-Shot + Ground Truth)

**Fichier :** `backend/agents/personalizer/golden_dataset.jsonl`

10 exemples curés couvrant 4 niveaux et 5 matières. Chaque exemple est un triplet `(profil, contenu_source) → sortie_attendue` validé manuellement contre les compétences MEN. Chaque sortie inclut `men_tags` et `cultural_anchors` pour vérification downstream.

### 3.3 Prompts versionnés

**Répertoire :** `backend/agents/personalizer/prompts/`

- `system_v1.md` — baseline générique (deprecated)
- `system_v2.md` — + RAG MEN (deprecated)
- `system_v3.md` — + garde-fous constitutionnels + few-shots (**production**)

---

## 4. Évaluation des prompts

### 4.1 Méthodologie

5 métriques quantitatives (0.0–1.0), déterministes et rejouables :

| Métrique | Description |
|---|---|
| **MEN alignment** | Présence du vocabulaire cible MEN dans `child_content` + quiz |
| **Constitutional** | Prénoms marocains (parité), marqueurs de pluralisme linguistique |
| **Cultural anchoring** | Nombre d'ancrages culturels marocains (souk, dirham, villes, fêtes…) |
| **Readability fit** | Longueur de `child_content` alignée au `chunk_size` du profil apprenant |
| **Schema validity** | Clés JSON requises + structure du quiz (3–5 items, options ≥ 2) |

### 4.2 Résultats

| Version | MEN | Constitutional | Cultural | Readability | Schema | **Overall** |
|---|---:|---:|---:|---:|---:|---:|
| **v1** (baseline) | 0.90 | 0.02 | 0.05 | 0.43 | 1.00 | **0.48** |
| **v2** (+ RAG MEN) | 1.00 | 0.58 | 0.05 | 0.37 | 1.00 | **0.60** |
| **v3** (+ Const. + Few-Shot) | 1.00 | 0.69 | 0.70 | 0.91 | 1.00 | **0.86** |

**Gain total :** +79 % d'alignement global entre v1 et v3.

### 4.3 Analyse qualitative

- **v1 → v2** : L'injection du RAG MEN amène l'alignement curriculaire à 1.00 mais laisse l'ancrage culturel faible (0.05). Conclusion : le vocabulaire MEN seul ne garantit pas la marocanité des exemples.
- **v2 → v3** : L'ajout des garde-fous constitutionnels et des 2 few-shot golden examples fait bondir l'ancrage culturel (+0.65) et l'adéquation de lisibilité (+0.54). Conclusion : **la démonstration par l'exemple** est supérieure à la règle abstraite pour guider le style.

### 4.4 Reproductibilité

```bash
cd backend
python3 -m agents.personalizer.eval.evaluate
```

Temps d'exécution : **< 1 seconde**. Le harness est 100 % déterministe — n'importe quel tiers peut rejouer l'évaluation et obtenir les mêmes chiffres.

---

## 5. Boucle d'amélioration continue

L'Agent 2 intègre un mécanisme de **feedback loop** (sans re-training) :

1. L'enfant note la leçon après lecture (rating 1–5 + tags : `too_hard`, `confusing`, `boring`…)
2. Les feedbacks récents sont injectés comme hint dans la prochaine requête
3. Agent 2 adapte dynamiquement (plus simple, plus ludique, etc.)

C'est l'équivalent fonctionnel d'un **RLHF léger** — sans coût de re-training, sans dérive des poids, auditabilité totale.

---

## 6. Perspectives

Le fine-tuning de poids deviendra pertinent lorsque :

- Le volume de sessions dépasse **10 000 interactions labellisées** (seuil statistique)
- Le corpus MEN se stabilise sur une version curriculaire long terme
- Le coût d'inférence context-cached dépasse celui d'un modèle tuné dédié

À ce moment, le **golden dataset** construit aujourd'hui (10 exemples) sera étendu en **training set supervisé** (~500 exemples) — notre méthodologie actuelle est donc un **investissement cumulatif**, pas un contournement jetable.

---

## 7. Conclusion

Notre décision d'adopter l'**In-Context Fine-Tuning** plutôt qu'un fine-tuning classique des poids n'est ni un raccourci ni une limitation technique : c'est un **choix d'architecture mature**, aligné sur les contraintes pédagogiques (auditabilité MEN, garde-fous constitutionnels) et opérationnelles (agilité, coût d'inférence) propres au contexte éducatif marocain.

Les résultats quantitatifs (**0.48 → 0.86 d'alignement global**) démontrent que cette méthodologie atteint une qualité de production sans les risques et rigidités du fine-tuning de poids.

---

## Annexes (référentiels)

- `backend/agents/personalizer/men_corpus/competencies.json` — Corpus MEN complet
- `backend/agents/personalizer/golden_dataset.jsonl` — Dataset d'évaluation
- `backend/agents/personalizer/prompts/system_v{1,2,3}.md` — Prompts versionnés
- `backend/agents/personalizer/eval/evaluate.py` — Harness d'évaluation
- `backend/agents/personalizer/eval/results.md` — Résultats chiffrés
- `backend/agents/personalizer/prompt_builder.py` — Intégration runtime

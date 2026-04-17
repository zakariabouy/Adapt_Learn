# AdaptLearn — Business Plan

**Scope :** projection sur 24 mois, contexte marocain. Tous les chiffres sont en MAD (Dirham marocain) avec conversions USD approximatives (1 USD ≈ 10 MAD).

---

## 1. Modèle économique

**B2B2C hybride**, priorité dans cet ordre :

1. **B2G** (public) — contrat pilote avec MEN / Académies Régionales → licence par établissement.
2. **B2B** (privé) — écoles privées marocaines (~3 000 écoles, ~500 k élèves) → abonnement par classe.
3. **B2C** (parents) — freemium + premium familial optionnel (long terme uniquement).

Le B2C direct marche mal au primaire marocain : les parents ne payent pas spontanément pour leurs enfants de 6–12 ans. On bâtit la crédibilité via les écoles d'abord.

---

## 2. Structure de coûts — 3 phases sur 24 mois

### Phase 1 — Finition MVP & Pilote (mois 1–6)

| Poste | Détail | MAD | USD |
|:--|:--|--:|--:|
| Équipe (2 fondateurs + 1 CTO junior mi-temps) | 3 × 6 mois, salaires minimaux equity-heavy | 180 000 | ~18 000 |
| Infra cloud (pilote 3 écoles, ~500 élèves) | GCP/AWS : VM, Postgres managé, Redis, storage | 18 000 | ~1 800 |
| LLM (Gemini 2.5 Flash + embeddings) | ~500 élèves actifs, voir §4 | 12 000 | ~1 200 |
| TTS (ElevenLabs) | 500 élèves × 20 min audio/mois × 6 mois | 24 000 | ~2 400 |
| Hugging Face (FLUX génération visuels) | Inference API, usage modéré | 6 000 | ~600 |
| Domaine, SSL, emails transactionnels | Namecheap + Resend + Sentry free | 3 000 | ~300 |
| Juridique (statuts SARL, CGU, RGPD/loi 09-08) | Avocat local one-shot | 15 000 | ~1 500 |
| Design & contenu pédagogique | Freelance graphiste + 1 conseiller pédagogique MEN | 30 000 | ~3 000 |
| Contingence (15 %) | | 43 000 | ~4 300 |
| **TOTAL Phase 1** | | **331 000** | **~33 100** |

### Phase 2 — Lancement commercial (mois 7–18)

| Poste | MAD / mois | Total 12 mois |
|:--|--:|--:|
| Équipe 5 pers. (2 devs + 1 commercial + 1 pédagogue + 1 ops) | 80 000 | 960 000 |
| Infra cloud (scaling ~5 000 élèves actifs) | 8 000 | 96 000 |
| LLM (5 000 élèves × 0.17 $/mois) | 8 500 | 102 000 |
| TTS + visuels | 15 000 | 180 000 |
| Bureau / frais généraux | 8 000 | 96 000 |
| Marketing B2B (salons EdTech, démos, content) | 10 000 | 120 000 |
| Comptabilité, fiscal | 4 000 | 48 000 |
| Contingence (10 %) | — | 160 000 |
| **TOTAL Phase 2** | | **~1 762 000 MAD (~176 000 USD)** |

### Phase 3 — Scale (mois 19–24, ~20 000 élèves actifs)

| Poste | MAD / mois |
|:--|--:|
| Équipe 10 pers. | 180 000 |
| Infra + LLM + TTS (économies d'échelle) | 60 000 |
| Ventes & marketing | 40 000 |
| G&A | 20 000 |
| **TOTAL mensuel scale** | **~300 000** (~30 000 USD) |

---

## 3. Total levée de fonds recommandée

| Phase | Budget | Sources |
|:--|--:|:--|
| Phase 1 (MVP → pilote) | 331 k MAD | Seed friends/family + concours (ENSET, MITEF, Startupbootcamp Africa) + subventions CCG Innov Invest |
| Phase 2 (12 mois commercial) | 1 762 k MAD | Seed Round — VCs locaux (Azur Innovation Fund, Maroc Numeric Fund, Outlierz) ou early-stage EdTech international |
| Phase 3 (6 mois scale) | 1 800 k MAD | Série A conditionnée à la traction |
| **Total 24 mois** | **≈ 3.9 M MAD (~390 k USD)** | |

**Besoin minimal pour atteindre une traction défendable :** ~2 M MAD (~200 k USD) sur 18 mois.

---

## 4. Coût unitaire — le chiffre qui compte

Par élève actif par mois (~150 interactions LLM / mois) :

| Poste | MAD | USD |
|:--|--:|--:|
| LLM Gemini 2.5 Flash (adaptation + quiz + orientation) | 1.70 | 0.17 |
| Embeddings (RAG retrieval) | 0.05 | 0.005 |
| TTS ElevenLabs (20 min audio/mois) | 4.00 | 0.40 |
| Visuels FLUX (~5 images/mois) | 1.00 | 0.10 |
| Infra cloud amortie | 1.50 | 0.15 |
| **COGS total / élève / mois** | **~8.25** | **~0.83** |

**Prix de vente cible B2B :** 25–40 MAD / élève / mois selon segment.
**Marge brute :** ~70–80 %.

---

## 5. Scénarios de revenus sur 24 mois

| Scénario | Élèves actifs fin M24 | ARR MAD | ARR USD |
|:--|--:|--:|--:|
| Conservateur | 5 000 (10 écoles privées) | 1.8 M | 180 k |
| **Base (promis au jury)** | **20 000 (40 écoles + 1 académie pilote)** | **7.2 M** | **720 k** |
| Optimiste (upside) | 60 000 (contrat MEN régional) | 21.6 M | 2.2 M |

**Break-even opérationnel :** ~12 000 élèves actifs avec l'équipe de 10 pers. (~mois 20 en scénario base).

---

## 6. Risques financiers & mitigations

| Risque | Impact | Mitigation |
|:--|:--|:--|
| Cycle de vente public long (18 mois+) | Cash burn | Attaquer écoles privées en parallèle pour cash-flow immédiat |
| Dépendance Gemini (pricing, quota) | COGS imprévisible | Fallback multi-providers déjà codé (Groq + heuristique) — prouvé au hackathon |
| Parents non-payeurs au primaire | Limite B2C | B2B2C uniquement Phases 1–2 |
| RGPD / loi marocaine 09-08 sur données enfants | Juridique | Audit CNDP dès M6, hébergement données Maroc (Atlas Cloud, OVH Casa) |
| Coût TTS (ElevenLabs ~40 % COGS) | Marge érodée | Migration progressive vers Coqui TTS self-hosted au-delà de 15k élèves |

---

## 7. Ce qu'on met dans le pitch jury

- **Budget Phase 1 uniquement :** 331 k MAD pour prouver la traction sur 3 écoles — un chiffre crédible pour un jury académique.
- **Unit economics :** « COGS ~8 MAD/élève/mois, prix de vente ~30 MAD → marge 73 % » en une seule slide.
- **Roadmap de financement :** seed → VC local → scale, pas une levée massive d'un coup.
- **Ne pas promettre** le scénario optimiste (60 k élèves) — promettre le scénario base et montrer l'optimiste comme upside.

---

## 8. Hypothèses principales (à paramétrer)

- 1 USD = 10 MAD (taux 2026-04).
- ~150 interactions LLM / élève / mois (base pour le COGS).
- Salaires Maroc : dev junior 12 k, dev senior 30 k, commercial 15 k, ops 10 k MAD/mois.
- Prix de vente B2B privé : 30 MAD / élève / mois.
- Prix de vente B2G public : 15 MAD / élève / mois (volume + subvention publique).
- Churn négligeable côté écoles sur 24 mois (contrats annuels).

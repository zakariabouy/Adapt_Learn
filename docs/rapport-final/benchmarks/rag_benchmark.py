"""
RAG Retrieval Benchmark — AdaptLearn MEN corpus
================================================

Measures retrieval quality of the MEN competencies corpus against a hand-built
gold set of 20 pedagogical queries. Reports Recall@1, Recall@3, Recall@5, and MRR.

Methodology
-----------
- **Corpus:** backend/agents/personalizer/men_corpus/competencies.json flattened
  into one chunk per (subject, grade) block. Each chunk concatenates the
  competencies + vocabulary + avoid-list for that cell.
- **Gold set:** 20 queries written by hand, each mapped to exactly one expected
  chunk id (subject/grade).
- **Retriever:** BM25 (Robertson-Sparck Jones, k1=1.5, b=0.75). This is a
  deliberately conservative lower bound — the production pipeline uses Google
  text-embedding-004 + pgvector HNSW, which should only do better on semantic
  queries. BM25 avoids any network or GPU dependency so judges can re-run the
  benchmark offline.
- **Reproducibility:** pure stdlib, deterministic. `python3 rag_benchmark.py`.

Metrics
-------
- Recall@K:  fraction of queries where the expected chunk appears in top-K.
- MRR:       mean reciprocal rank of the expected chunk across the query set.
- P@1:       same as Recall@1 when each query has exactly one gold chunk.
"""

from __future__ import annotations

import json
import math
import re
import time
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CORPUS_PATH = ROOT / "backend" / "agents" / "personalizer" / "men_corpus" / "competencies.json"
OUT_PATH = Path(__file__).resolve().parent / "rag_benchmark_results.json"

# French stopwords — small list, plenty for BM25 on this domain.
STOPWORDS = {
    "le", "la", "les", "un", "une", "des", "du", "de", "d", "et", "ou", "à",
    "au", "aux", "en", "dans", "sur", "pour", "par", "avec", "sans", "sous",
    "ce", "cet", "cette", "ces", "mon", "ma", "mes", "ton", "ta", "tes", "son",
    "sa", "ses", "notre", "votre", "leur", "qui", "que", "qu", "quoi", "dont",
    "où", "est", "sont", "être", "avoir", "a", "ont", "plus", "moins", "très",
    "si", "non", "oui", "pas", "ne", "n", "se", "s", "y", "il", "elle", "on",
    "ils", "elles", "je", "tu", "nous", "vous", "l",
}


def tokenize(text: str) -> list[str]:
    text = text.lower()
    # Keep accented chars; strip punctuation.
    tokens = re.findall(r"[a-zà-ÿ0-9]+", text)
    return [t for t in tokens if t not in STOPWORDS and len(t) > 1]


# ────────────────────────────────────────────────────────────────────────────
# Corpus loading: flatten competencies.json into one chunk per (subject, grade)
# ────────────────────────────────────────────────────────────────────────────

def load_corpus() -> list[dict]:
    raw = json.loads(CORPUS_PATH.read_text())
    chunks = []
    for subject, grades in raw.get("subjects", {}).items():
        if not isinstance(grades, dict):
            continue
        for grade, cell in grades.items():
            if grade.startswith("_") or not isinstance(cell, dict):
                continue
            parts = []
            parts.extend(cell.get("competencies", []))
            vocab = cell.get("vocabulary", [])
            if vocab:
                parts.append("Vocabulaire clé : " + ", ".join(vocab))
            themes = cell.get("themes_culturels", [])
            if themes:
                parts.append("Thèmes culturels : " + ", ".join(themes))
            examples = cell.get("examples_ancres", [])
            if examples:
                parts.append("Exemples ancrés : " + ", ".join(examples))
            note = cell.get("pedagogical_note")
            if note:
                parts.append(note)
            avoid = cell.get("avoid", [])
            if avoid:
                parts.append("À éviter : " + ", ".join(avoid))
            chunks.append({
                "id": f"{subject}/{grade}",
                "subject": subject,
                "grade": grade,
                "text": " ".join(parts),
            })
    return chunks


# ────────────────────────────────────────────────────────────────────────────
# BM25
# ────────────────────────────────────────────────────────────────────────────

class BM25:
    def __init__(self, docs: list[list[str]], k1: float = 1.5, b: float = 0.75):
        self.docs = docs
        self.k1 = k1
        self.b = b
        self.N = len(docs)
        self.avgdl = sum(len(d) for d in docs) / max(self.N, 1)
        self.doc_freq: Counter[str] = Counter()
        self.term_freq: list[Counter[str]] = []
        for d in docs:
            tf = Counter(d)
            self.term_freq.append(tf)
            for term in tf:
                self.doc_freq[term] += 1
        self.idf = {
            term: math.log(1 + (self.N - df + 0.5) / (df + 0.5))
            for term, df in self.doc_freq.items()
        }

    def score(self, query: list[str], doc_idx: int) -> float:
        score = 0.0
        tf = self.term_freq[doc_idx]
        dl = len(self.docs[doc_idx])
        for term in query:
            if term not in tf:
                continue
            freq = tf[term]
            idf = self.idf.get(term, 0.0)
            num = freq * (self.k1 + 1)
            den = freq + self.k1 * (1 - self.b + self.b * dl / self.avgdl)
            score += idf * num / den
        return score

    def rank(self, query: list[str]) -> list[tuple[int, float]]:
        scores = [(i, self.score(query, i)) for i in range(self.N)]
        scores.sort(key=lambda x: x[1], reverse=True)
        return scores


# ────────────────────────────────────────────────────────────────────────────
# Gold set: 20 queries, each with one expected chunk id.
# ────────────────────────────────────────────────────────────────────────────

# Two slices of gold queries:
#   VERBATIM  — query shares surface vocabulary with the target chunk (easy).
#   PARAPHRASE — query expresses the same intent with *different* words
#               (no or very little vocabulary overlap). This is the harder,
#               more realistic slice — a teacher rarely types the exact terms
#               from the MEN référentiel.
GOLD_QUERIES: list[dict] = [
    # mathematiques
    {"q": "apprendre à compter les nombres unités dizaines centaines jusqu'à 999",
     "expected": "mathematiques/CE1"},
    {"q": "tables de multiplication jusqu'à 10 et notion de moitié",
     "expected": "mathematiques/CE2"},
    {"q": "fractions simples numérateur dénominateur et aire du rectangle",
     "expected": "mathematiques/CM1"},
    {"q": "pourcentage proportionnalité et volume du cube et pavé droit",
     "expected": "mathematiques/CM2"},
    # francais (langue seconde)
    {"q": "français langue seconde vocabulaire de base couleurs nombres famille école",
     "expected": "francais/CE1"},
    {"q": "conjuguer être avoir verbes du premier groupe au présent",
     "expected": "francais/CE2"},
    {"q": "lire texte 100 mots idées principales passé composé futur simple",
     "expected": "francais/CM1"},
    {"q": "rédiger un texte structuré et résumer un texte dans ses propres mots",
     "expected": "francais/CM2"},
    # arabe
    {"q": "lire des textes courts vocalisés en arabe 25 à 40 mots",
     "expected": "arabe/CE1"},
    {"q": "accorder le verbe avec son sujet singulier pluriel artisanat zellige",
     "expected": "arabe/CE2"},
    {"q": "paragraphe structuré conjugaison présent passé futur patrimoine amazigh",
     "expected": "arabe/CM1"},
    {"q": "textes narratif informatif argumentatif temps composés distinguer fait opinion",
     "expected": "arabe/CM2"},
    # activite_scientifique
    {"q": "observer le vivant plantes animaux du Maroc et les 5 sens",
     "expected": "activite_scientifique/CE1"},
    {"q": "cycle de vie des plantes états de la matière chaîne alimentaire",
     "expected": "activite_scientifique/CE2"},
    {"q": "corps humain squelette digestion énergies solaire éolienne Noor",
     "expected": "activite_scientifique/CM1"},
    {"q": "système solaire phases de la Lune circuit électrique biodiversité",
     "expected": "activite_scientifique/CM2"},
    # education_islamique
    {"q": "cinq piliers de l'Islam valeurs respect des parents partage honnêteté",
     "expected": "education_islamique/CE1"},
    {"q": "valeurs citoyennes vivre-ensemble respect de la diversité religieuse tolérance",
     "expected": "education_islamique/CM1"},
    # education_civique
    {"q": "symboles du Royaume drapeau hymne devise Allah Al-Watan Al-Malik droits de l'enfant",
     "expected": "education_civique/transversal"},
    {"q": "égalité fille garçon diversité culturelle et linguistique du Maroc",
     "expected": "education_civique/transversal"},
]

# ── Paraphrased queries: same intent, minimal vocabulary overlap with the
#    target chunk. These stress the retriever on semantic generalization.
PARAPHRASE_QUERIES: list[dict] = [
    {"q": "diviser un gâteau en parts égales pour comprendre les morceaux",
     "expected": "mathematiques/CM1"},
    {"q": "combien ça coûte si chaque cahier vaut 12 dirhams et on en achète 5",
     "expected": "mathematiques/CE2"},
    {"q": "enseigner la taille des formes rondes et carrées à un petit",
     "expected": "mathematiques/CE1"},
    {"q": "calculer l'espace occupé par une boîte cubique",
     "expected": "mathematiques/CM2"},
    {"q": "premiers mots en français pour un enfant qui parle arabe à la maison",
     "expected": "francais/CE1"},
    {"q": "écrire une petite rédaction avec début milieu fin",
     "expected": "francais/CM1"},
    {"q": "raconter une histoire à haute voix en arabe classique",
     "expected": "arabe/CE2"},
    {"q": "comment sont nourris les lézards et les plantes dans la nature",
     "expected": "activite_scientifique/CE2"},
    {"q": "expliquer pourquoi il ne faut pas gaspiller l'eau aux enfants",
     "expected": "activite_scientifique/CM2"},
    {"q": "apprendre la politesse et l'entraide selon la tradition religieuse",
     "expected": "education_islamique/CE1"},
]

# ── Out-of-domain queries: should NOT match any MEN chunk. We report how
#    many are rejected (top-1 score below a threshold) to estimate the
#    false-positive surface of the retriever.
OUT_OF_DOMAIN_QUERIES: list[str] = [
    "meilleure recette de pastilla au poulet",
    "comment réparer un moteur de voiture diesel",
    "derniers résultats du championnat de football européen",
    "prix du baril de pétrole brent aujourd'hui",
    "itinéraire touristique de 7 jours à Tokyo",
]



# ────────────────────────────────────────────────────────────────────────────
# Evaluation
# ────────────────────────────────────────────────────────────────────────────

def _run_slice(slice_name: str, queries: list[dict], chunks: list[dict],
               bm25: "BM25") -> tuple[dict, list[dict]]:
    """Score a slice of positive queries against the corpus."""
    available_ids = {c["id"] for c in chunks}
    kept = [g for g in queries if g["expected"] in available_ids]
    dropped = len(queries) - len(kept)

    recall_at = {1: 0, 3: 0, 5: 0}
    rr_sum = 0.0
    per_query = []
    latencies_ms = []

    for g in kept:
        q_tokens = tokenize(g["q"])
        t0 = time.perf_counter()
        ranked = bm25.rank(q_tokens)
        latencies_ms.append((time.perf_counter() - t0) * 1000)

        expected_idx = next(i for i, c in enumerate(chunks) if c["id"] == g["expected"])
        rank = next((r + 1 for r, (i, _) in enumerate(ranked) if i == expected_idx), None)

        if rank:
            rr_sum += 1.0 / rank
            for k in recall_at:
                if rank <= k:
                    recall_at[k] += 1

        per_query.append({
            "slice": slice_name,
            "query": g["q"],
            "expected": g["expected"],
            "retrieved_top1": chunks[ranked[0][0]]["id"],
            "rank_of_expected": rank,
            "top1_score": round(ranked[0][1], 3),
        })

    n = max(len(kept), 1)
    summary = {
        "slice": slice_name,
        "n": len(kept),
        "dropped": dropped,
        "recall_at_1": round(recall_at[1] / n, 3),
        "recall_at_3": round(recall_at[3] / n, 3),
        "recall_at_5": round(recall_at[5] / n, 3),
        "mrr": round(rr_sum / n, 3),
        "mean_latency_ms": round(sum(latencies_ms) / n, 4),
        "p95_latency_ms": round(
            sorted(latencies_ms)[int(0.95 * (n - 1))], 4),
    }
    return summary, per_query


def _run_ood(queries: list[str], chunks: list[dict], bm25: "BM25",
             reject_threshold: float) -> dict:
    """Score out-of-domain queries: correct behavior is a low top-1 score.

    We report the rejection rate (top-1 score below `reject_threshold`) so
    a reader can see the retriever does not blindly return something for
    every query — an honest precision signal that recall@K alone misses.
    """
    rejected = 0
    top1_scores = []
    per_query = []
    for q in queries:
        ranked = bm25.rank(tokenize(q))
        score = ranked[0][1] if ranked else 0.0
        top1 = chunks[ranked[0][0]]["id"] if ranked else None
        top1_scores.append(score)
        is_rejected = score < reject_threshold
        if is_rejected:
            rejected += 1
        per_query.append({
            "slice": "out_of_domain",
            "query": q,
            "top1_id": top1,
            "top1_score": round(score, 3),
            "rejected": is_rejected,
        })
    n = max(len(queries), 1)
    return {
        "summary": {
            "slice": "out_of_domain",
            "n": len(queries),
            "reject_threshold": reject_threshold,
            "rejection_rate": round(rejected / n, 3),
            "mean_top1_score": round(sum(top1_scores) / n, 3),
            "max_top1_score": round(max(top1_scores) if top1_scores else 0.0, 3),
        },
        "per_query": per_query,
    }


def evaluate():
    chunks = load_corpus()
    tokenized = [tokenize(c["text"]) for c in chunks]
    bm25 = BM25(tokenized)

    verbatim_summary, verbatim_rows = _run_slice("verbatim", GOLD_QUERIES, chunks, bm25)
    para_summary, para_rows = _run_slice("paraphrase", PARAPHRASE_QUERIES, chunks, bm25)

    # Reject-threshold = mean top-1 score on positive queries × 0.5.
    # Any OOD query scoring below that is treated as "no match".
    positive_top1 = [r["top1_score"] for r in verbatim_rows + para_rows]
    reject_threshold = round(
        (sum(positive_top1) / max(len(positive_top1), 1)) * 0.5, 3)
    ood = _run_ood(OUT_OF_DOMAIN_QUERIES, chunks, bm25, reject_threshold)

    payload = {
        "retriever": "BM25 (k1=1.5, b=0.75) — offline lexical baseline",
        "corpus_chunks": len(chunks),
        "slices": {
            "verbatim": verbatim_summary,
            "paraphrase": para_summary,
            "out_of_domain": ood["summary"],
        },
        "per_query": verbatim_rows + para_rows + ood["per_query"],
    }

    OUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False))

    print("=== RAG Retrieval Benchmark ===\n")
    print(f"Retriever : {payload['retriever']}")
    print(f"Corpus chunks : {payload['corpus_chunks']}\n")
    print(f"{'slice':<16s} {'n':>3s} {'R@1':>6s} {'R@3':>6s} {'R@5':>6s} "
          f"{'MRR':>6s} {'p95 ms':>8s}")
    for s in (verbatim_summary, para_summary):
        print(f"{s['slice']:<16s} {s['n']:>3d} {s['recall_at_1']:>6.2f} "
              f"{s['recall_at_3']:>6.2f} {s['recall_at_5']:>6.2f} "
              f"{s['mrr']:>6.3f} {s['p95_latency_ms']:>8.4f}")
    o = ood["summary"]
    print(f"\n{o['slice']:<16s} n={o['n']}  reject_threshold={o['reject_threshold']}  "
          f"rejection_rate={o['rejection_rate']}  "
          f"max_top1={o['max_top1_score']}")
    print(f"\nResults written to {OUT_PATH}")
    return payload


if __name__ == "__main__":
    evaluate()

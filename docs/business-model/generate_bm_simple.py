# -*- coding: utf-8 -*-
"""
Business Model d'AdaptLearn — document PDF sobre et lisible.
Contenu base sur le framework RallyIA / Orange Digital Center
("Construire les Business Models a l'ere de l'IA"), sans en copier le design.
Mise en page : A4 portrait, fond blanc, typographie claire.
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                TableStyle, HRFlowable, ListFlowable, ListItem)

# ---- couleurs sobres ----
INK = colors.HexColor("#1A1A1A")
GREY = colors.HexColor("#555555")
LINE = colors.HexColor("#D6D6D6")
ACCENT = colors.HexColor("#1F4E79")     # bleu fonce discret
HEADBG = colors.HexColor("#EEF2F6")     # gris-bleu tres clair pour entetes de table
ZEBRA = colors.HexColor("#F7F8FA")

styles = getSampleStyleSheet()


def S(name, **kw):
    return ParagraphStyle(name, parent=styles["Normal"], **kw)


title_st = S("t", fontName="Helvetica-Bold", fontSize=22, textColor=INK, leading=26, spaceAfter=2)
sub_st = S("s", fontName="Helvetica", fontSize=11.5, textColor=GREY, leading=15, spaceAfter=2)
h1_st = S("h1", fontName="Helvetica-Bold", fontSize=13.5, textColor=ACCENT, leading=17,
          spaceBefore=14, spaceAfter=6)
body_st = S("b", fontName="Helvetica", fontSize=10.5, textColor=INK, leading=15.5, spaceAfter=4,
            alignment=TA_LEFT)
small_st = S("sm", fontName="Helvetica", fontSize=9.5, textColor=GREY, leading=13)
cell_st = S("c", fontName="Helvetica", fontSize=9.5, textColor=INK, leading=13)
cellb_st = S("cb", fontName="Helvetica-Bold", fontSize=9.5, textColor=INK, leading=13)
cellh_st = S("ch", fontName="Helvetica-Bold", fontSize=9.5, textColor=ACCENT, leading=13)
num_st = S("n", fontName="Helvetica-Bold", fontSize=9.5, textColor=INK, leading=13, alignment=TA_CENTER)


def P(t, st=body_st):
    return Paragraph(t, st)


def bullets(items, st=body_st):
    return ListFlowable(
        [ListItem(P(t, st), leftIndent=6, value="•") for t in items],
        bulletType="bullet", bulletColor=ACCENT, bulletFontSize=8,
        leftIndent=12, spaceBefore=1, spaceAfter=4,
    )


def rule():
    return HRFlowable(width="100%", thickness=0.7, color=LINE, spaceBefore=4, spaceAfter=8)


def two_col_table(rows, w1, w2, header=None):
    data = []
    if header:
        data.append([P(header[0], cellh_st), P(header[1], cellh_st)])
    for a, b in rows:
        left = a if hasattr(a, "wrap") else P(a, cellb_st)
        right = b if hasattr(b, "wrap") else P(b, cell_st)
        data.append([left, right])
    t = Table(data, colWidths=[w1, w2])
    ts = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]
    start = 0
    if header:
        ts += [("BACKGROUND", (0, 0), (-1, 0), HEADBG),
               ("LINEABOVE", (0, 0), (-1, 0), 0.6, ACCENT)]
        start = 1
    for i in range(start, len(data)):
        if (i - start) % 2 == 1:
            ts.append(("BACKGROUND", (0, i), (-1, i), ZEBRA))
    t.setStyle(TableStyle(ts))
    return t


# ============================================================ build
doc = SimpleDocTemplate(
    "business-model-adaptlearn.pdf", pagesize=A4,
    leftMargin=20 * mm, rightMargin=20 * mm,
    topMargin=18 * mm, bottomMargin=16 * mm,
    title="AdaptLearn — Business Model", author="AdaptLearn",
)
W = doc.width
st = []

# --- En-tete ---
st.append(P("AdaptLearn — Business Model", title_st))
st.append(P("Plateforme d'apprentissage adaptatif par IA pour le primaire (6–12 ans) — Maroc",
            sub_st))
st.append(P("Document structuré selon le framework « Business Models à l'ère de l'IA » "
            "(RallyIA / Orange Digital Center).", small_st))
st.append(rule())

# --- 1. Resume ---
st.append(P("1. Résumé", h1_st))
st.append(P(
    "AdaptLearn personnalise l'apprentissage de chaque élève du primaire grâce à un "
    "système multi-agents : il profile l'enfant par le jeu, réécrit chaque leçon selon "
    "son profil, adapte les quiz en temps réel et fournit aux enseignants une orientation "
    "fondée sur des données. Le modèle est un <b>SaaS B2B2C</b> vendu aux écoles "
    "(publiques et privées), avec une marge brute d'environ <b>73 %</b>.", body_st))

# --- 2. Probleme ---
st.append(P("2. Le problème", h1_st))
st.append(P(
    "Au primaire, chaque enfant reçoit le même manuel, le même rythme et le même test. "
    "Un enseignant qui gère 30 à 40 élèves ne peut pas personnaliser. Les écarts pris tôt "
    "se cumulent sur les six années du cycle et deviennent difficiles à rattraper.", body_st))
st.append(bullets([
    "Contenu uniforme pour des profils d'apprentissage très différents.",
    "Décrochage détecté tard, souvent par l'échec.",
    "Orientation basée sur des notes plutôt que sur des données d'apprentissage.",
]))

# --- 3. Les 7 questions ---
st.append(P("3. Les 7 questions du business model IA", h1_st))
rows = [
    ("1. Quel problème ?",
     "Au primaire, l'enseignement uniforme creuse des écarts d'apprentissage qui deviennent irréversibles."),
    ("2. Pour qui ?",
     "Écoles publiques (B2G) et privées (B2B), parents (B2C) ; l'utilisateur final est l'élève de 6 à 12 ans."),
    ("3. Quelle valeur ?",
     "Temps d'enseignant rendu, décrochage réduit, progression mesurable et orientation fiable."),
    ("4. Comment l'IA crée la valeur ?",
     "Système multi-agents (LangGraph) : profilage par le jeu, réécriture de contenu, quiz adaptatifs (IRT), orientation longitudinale."),
    ("5. Comment gagne-t-on de l'argent ?",
     "Abonnement B2B par élève/mois, licence par établissement (B2G), premium familial à terme."),
    ("6. Quel avantage compétitif ?",
     "Données pédagogiques propriétaires, boucle d'auto-renforcement, validation enseignant (HITL) et support multilingue."),
    ("7. Comment passer à l'échelle ?",
     "Coût marginal faible (~8 MAD/élève), même moteur pour toutes les écoles, fallback multi-LLM, contenu réutilisable."),
]
st.append(two_col_table(rows, W * 0.34, W * 0.66, header=("Question", "Réponse — AdaptLearn")))

# --- 4. Proposition de valeur ---
st.append(P("4. Proposition de valeur", h1_st))
st.append(P("<b>Ce qu'AdaptLearn apporte (value map)</b>", body_st))
st.append(bullets([
    "<b>Produit IA</b> — un tuteur adaptatif multi-agents.",
    "<b>Réducteurs de douleur</b> — personnalisation à grande échelle, sans surcharger l'enseignant.",
    "<b>Créateurs de gain</b> — progression mesurable et orientation fondée sur les données.",
]))
st.append(P("<b>Ce que vit le client (profil)</b>", body_st))
st.append(bullets([
    "<b>Tâches</b> — instruire ~35 élèves, suivre chacun, orienter.",
    "<b>Douleurs</b> — manque de temps, décrochage invisible, classes hétérogènes.",
    "<b>Gains attendus</b> — élèves qui progressent, parents rassurés, données fiables.",
]))
st.append(P("<b>Fit produit-marché</b> : chaque douleur de l'école est adressée par au moins "
            "un réducteur de douleur, et l'IA est indispensable à la solution — pas un simple gadget.",
            small_st))

# --- 5. Business model canvas ---
st.append(P("5. Business Model Canvas (adapté IA)", h1_st))
canvas_rows = [
    ("Segments clients", "Écoles publiques (B2G), écoles privées (B2B), parents (B2C, à terme)."),
    ("Proposition de valeur", "Un tuteur adaptatif par enfant : contenu réécrit, quiz IRT, suivi temps réel, orientation."),
    ("Canaux & relations", "Ventes B2B, pilotes avec les académies, démonstrations écoles, bouche-à-oreille parents."),
    ("Sources de revenus", "B2B ~30 MAD/élève/mois, B2G ~15 MAD, premium familial. Marge brute ~73 %."),
    ("Données (actif clé)", "Profils, télémétrie d'engagement, résultats de quiz, contenu enseignant (RAG). Conforme RGPD / loi 09-08."),
    ("Ressources IA", "LangGraph, Gemini 2.5 Flash + Groq (fallback), embeddings, ingénieurs IA, cloud."),
    ("Activités clés", "Profilage, adaptation, monitoring, génération d'examens, file de validation enseignant."),
    ("Boucle d'apprentissage", "Chaque interaction affine le profil et le contenu de l'élève (data flywheel)."),
    ("Partenaires clés", "MEN / académies, écoles, fournisseurs LLM (Gemini, Groq, Hugging Face), hébergeurs au Maroc."),
    ("Structure de coûts", "Inférence LLM, TTS, visuels, infrastructure cloud, talent IA (~8,25 MAD/élève/mois)."),
]
st.append(two_col_table(canvas_rows, W * 0.30, W * 0.70, header=("Bloc", "Contenu")))

# --- 6. Modele economique & unit economics ---
st.append(P("6. Modèle économique & unit economics", h1_st))
st.append(P(
    "Modèle retenu : <b>SaaS IA en B2B2C</b> — on vend l'accès à un tuteur adaptatif, facturé "
    "à l'élève actif. À terme, une brique « paiement au résultat » (liée à la progression mesurée) "
    "renforce l'alignement avec les écoles.", body_st))

st.append(P("Niveaux de prix", small_st))
price_rows = [
    ("B2G — public", "Licence par établissement — ~15 MAD / élève / mois."),
    ("B2B — privé", "Abonnement par classe — ~30 MAD / élève / mois."),
    ("B2C — parents", "Freemium + premium familial (à terme)."),
]
st.append(two_col_table(price_rows, W * 0.30, W * 0.70))
st.append(Spacer(1, 6))

st.append(P("Coût par élève actif / mois", small_st))
ue_data = [
    [P("Poste", cellh_st), P("Coût (MAD)", cellh_st)],
    [P("LLM (adaptation + quiz + orientation)", cell_st), P("1,70", cell_st)],
    [P("TTS (lecture audio)", cell_st), P("4,00", cell_st)],
    [P("Visuels (génération d'images)", cell_st), P("1,00", cell_st)],
    [P("Embeddings + infrastructure amortie", cell_st), P("1,55", cell_st)],
    [P("COGS total", cellb_st), P("~ 8,25", cellb_st)],
    [P("Prix de vente B2B", cellb_st), P("~ 30,00", cellb_st)],
    [P("Marge brute", cellb_st), P("~ 73 %", cellb_st)],
]
ue = Table(ue_data, colWidths=[W * 0.70, W * 0.30])
ue.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("ALIGN", (1, 0), (1, -1), "RIGHT"),
    ("BACKGROUND", (0, 0), (-1, 0), HEADBG),
    ("LINEABOVE", (0, 0), (-1, 0), 0.6, ACCENT),
    ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
    ("LINEABOVE", (0, 5), (-1, 5), 0.6, INK),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
]))
st.append(ue)

# --- 7. Marche & scenarios ---
st.append(P("7. Marché & scénarios de revenus", h1_st))
st.append(bullets([
    "<b>TAM</b> — ~4 M élèves au primaire (public + privé, Maroc).",
    "<b>SAM</b> — ~500 k élèves du privé + écoles connectées.",
    "<b>SOM (24 mois)</b> — 20 000 élèves : 40 écoles + 1 académie pilote.",
]))
sc_data = [
    [P("Scénario", cellh_st), P("Élèves (fin M24)", cellh_st), P("ARR", cellh_st)],
    [P("Conservateur", cell_st), P("5 000 (10 écoles)", cell_st), P("1,8 M MAD", cell_st)],
    [P("Base (cible)", cellb_st), P("20 000 (40 écoles + académie)", cellb_st), P("7,2 M MAD", cellb_st)],
    [P("Optimiste", cell_st), P("60 000 (contrat MEN régional)", cell_st), P("21,6 M MAD", cell_st)],
]
sc = Table(sc_data, colWidths=[W * 0.24, W * 0.50, W * 0.26])
sc.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("ALIGN", (2, 0), (2, -1), "RIGHT"),
    ("BACKGROUND", (0, 0), (-1, 0), HEADBG),
    ("LINEABOVE", (0, 0), (-1, 0), 0.6, ACCENT),
    ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
    ("BACKGROUND", (0, 2), (-1, 2), ZEBRA),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
]))
st.append(sc)
st.append(Spacer(1, 6))
st.append(P("Seuil de rentabilité opérationnel : ~12 000 élèves actifs (vers le mois 20). "
            "Financement : 331 k MAD pour le pilote (3 écoles), ~3,9 M MAD au total sur 24 mois "
            "(seed > VC local > scale).", small_st))

# --- 8. Avantage competitif ---
st.append(P("8. Avantage compétitif (pourquoi nous, pourquoi maintenant)", h1_st))
st.append(bullets([
    "<b>Données propriétaires</b> — des années de signaux d'apprentissage par élève, irréplicables par un nouvel entrant.",
    "<b>Data flywheel</b> — plus d'élèves > plus de données > meilleur modèle > meilleure expérience > plus d'élèves.",
    "<b>Confiance & validation enseignant (HITL)</b> — condition d'adoption en B2G et B2B.",
    "<b>Multilingue local</b> — français / darija / arabe : barrière réelle pour les acteurs étrangers.",
    "<b>Coût maîtrisé</b> — fallback multi-LLM (Groq + Gemini) déjà en place, COGS sous contrôle.",
    "<b>Timing</b> — LLM devenus abordables et digitalisation de l'éducation au Maroc.",
]))

# --- 9. Erreurs evitees ---
st.append(P("9. Erreurs classiques évitées", h1_st))
st.append(bullets([
    "Construire la tech avant le besoin > on part d'un problème validé (les écoles ne peuvent pas personnaliser).",
    "Oublier le client > quatre rôles produits (élève, enseignant, parent, admin) + validation humaine.",
    "Ignorer le coût d'inférence > COGS 8 MAD &lt; prix 30 MAD, fallback multi-LLM.",
    "Aucune différenciation > données propriétaires + flywheel + multilingue (pas un simple wrapper GPT).",
    "Pas de stratégie data > données structurées, conformes (loi 09-08) et capitalisées : le flywheel est le moat.",
]))

# --- 10. Synthese ---
st.append(P("10. Synthèse en une phrase", h1_st))
st.append(P(
    "« AdaptLearn transforme chaque leçon en un parcours personnalisé grâce à un système "
    "multi-agents qui apprend de chaque enfant — un SaaS B2B2C à ~30 MAD/élève/mois, "
    "marge ~73 %, dont la donnée propriétaire constitue le véritable avantage. »",
    S("q", fontName="Helvetica-Oblique", fontSize=11, textColor=INK, leading=16)))

doc.build(st)
print("OK -> business-model-adaptlearn.pdf")

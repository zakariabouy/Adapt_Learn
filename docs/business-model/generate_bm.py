# -*- coding: utf-8 -*-
"""
Generateur du Business Model IA d'AdaptLearn.
Applique le framework RallyIA / Orange Digital Center "Construire les
Business Models du futur a l'ere de l'IA" au projet AdaptLearn.
Sortie : deck PDF 16:9, en francais.
"""
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color

W, H = 1280, 720
MARGIN = 56

# ---- Palette (inspiree du deck source) ----
BG      = HexColor("#0A0F1E")
PANEL   = HexColor("#131C33")
PANEL2  = HexColor("#0F1729")
GOLD    = HexColor("#F4C84A")
GOLDSOFT= HexColor("#FFE08A")
WHITE   = HexColor("#FFFFFF")
MUTE    = HexColor("#8A93A8")
MUTE2   = HexColor("#5E6781")
RED     = HexColor("#FF6B6B")
GREEN   = HexColor("#4ADE80")
BLUE    = HexColor("#5B9DF9")
PINK    = HexColor("#F472B6")
ORANGE  = HexColor("#FB923C")
PURPLE  = HexColor("#A78BFA")
TEAL    = HexColor("#2DD4BF")

REG = "Helvetica"
BLD = "Helvetica-Bold"
OBL = "Helvetica-Oblique"

c = canvas.Canvas("business-model-ia-adaptlearn.pdf", pagesize=(W, H))


def Y(top):
    return H - top


def wrap(text, font, size, maxw):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if c.stringWidth(t, font, size) <= maxw:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def par(x, top, text, font, size, color, maxw, leading=None):
    leading = leading or size + 5
    y = Y(top)
    c.setFont(font, size)
    c.setFillColor(color)
    for ln in wrap(text, font, size, maxw):
        c.drawString(x, y, ln)
        y -= leading
    return H - y  # return new "top"


def bg():
    c.setFillColor(BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)


def brandmark(x, top):
    # petit boomerang dore stylise
    c.setFillColor(GOLD)
    c.setStrokeColor(GOLD)
    c.setLineWidth(5)
    c.line(x, Y(top + 14), x + 16, Y(top))
    c.line(x + 16, Y(top), x + 34, Y(top + 18))
    c.setFont(BLD, 13)
    c.drawString(x + 44, Y(top + 6), "AdaptLearn")
    c.setFont(REG, 9)
    c.setFillColor(MUTE)
    c.drawString(x + 44, Y(top + 18), "BUSINESS MODEL IA")


def footer(page, total=12):
    c.setFillColor(MUTE2)
    c.setFont(REG, 9)
    c.drawString(MARGIN, 26, "AdaptLearn  |  Apprentissage adaptatif par IA  |  Maroc")
    c.drawRightString(W - MARGIN, 26, "%02d / %02d" % (page, total))


def header(label):
    # bandeau type "SLIDE 0X . ..."
    c.setFillColor(PANEL)
    c.roundRect(MARGIN, Y(118), W - 2 * MARGIN, 34, 6, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.setFont(BLD, 11)
    c.drawString(MARGIN + 18, Y(110), label)


def title(text, top=150, size=46, color=WHITE, accent_word=None, accent_color=GOLD,
          x=MARGIN, maxw=W - 2 * MARGIN):
    c.setFont(BLD, size)
    y = Y(top + size)
    for ln in wrap(text, BLD, size, maxw):
        # support d'un mot mis en valeur
        if accent_word and accent_word in ln:
            before, _, after = ln.partition(accent_word)
            cx = x
            c.setFillColor(color); c.drawString(cx, y, before)
            cx += c.stringWidth(before, BLD, size)
            c.setFillColor(accent_color); c.drawString(cx, y, accent_word)
            cx += c.stringWidth(accent_word, BLD, size)
            c.setFillColor(color); c.drawString(cx, y, after)
        else:
            c.setFillColor(color); c.drawString(x, y, ln)
        y -= size + 6
    return H - y


def card(x, top, w, h, accent=None, fill=PANEL, radius=10):
    c.setFillColor(fill)
    c.roundRect(x, Y(top + h), w, h, radius, fill=1, stroke=0)
    if accent:
        c.setFillColor(accent)
        c.roundRect(x, Y(top + 4), w, 4, 2, fill=1, stroke=0)


def chip(x, top, text, color):
    c.setFont(BLD, 10)
    c.setFillColor(color)
    c.drawString(x, Y(top + 8), text.upper())


# =====================================================================
# 01 — COUVERTURE
# =====================================================================
def slide_cover():
    bg()
    # bande verticale doree
    c.setFillColor(PANEL2)
    c.rect(W - 360, 0, 360, H, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.rect(0, 0, 8, H, fill=1, stroke=0)
    brandmark(MARGIN, 60)

    c.setFillColor(GOLD)
    c.setFont(BLD, 13)
    c.drawString(MARGIN, Y(200), "BUSINESS MODEL  .  A L'ERE DE L'IA")

    title("Construire le Business Model d'AdaptLearn",
          top=240, size=58, accent_word="AdaptLearn", maxw=760)

    par(MARGIN, 470,
        "Transformer une plateforme educative multi-agents en un modele "
        "economique viable, scalable et defendable — applique au framework "
        "RallyIA / Orange Digital Center.",
        REG, 16, MUTE, 700, leading=24)

    # cartes resume a droite
    items = [
        ("PROBLEME", "L'enseignement uniforme au primaire", RED),
        ("SOLUTION", "Un tuteur adaptatif par enfant", GREEN),
        ("MODELE", "SaaS B2B2C — ~73% de marge brute", GOLD),
    ]
    ty = 240
    for lbl, txt, col in items:
        card(W - 320, ty, 264, 88, accent=col, fill=BG)
        chip(W - 300, ty + 18, lbl, col)
        par(W - 300, ty + 40, txt, BLD, 15, WHITE, 230, leading=19)
        ty += 104
    footer(1)
    c.showPage()


# =====================================================================
# 02 — LE PROBLEME
# =====================================================================
def slide_problem():
    bg()
    header("SLIDE 02  .  PRISE DE CONSCIENCE")
    title("Le probleme qu'on resout", accent_word="probleme")

    par(MARGIN, 300,
        "Au primaire (6–12 ans), chaque enfant recoit le meme manuel, le meme "
        "rythme, le meme test. Un enseignant qui gere 30 a 40 eleves ne peut "
        "pas personnaliser. Les ecarts pris tot se cumulent sur 6 ans.",
        REG, 15, MUTE, 520, leading=23)

    card(MARGIN, 420, 520, 165, accent=GOLD, fill=PANEL)
    c.setFillColor(GOLD); c.setFont(BLD, 48)
    c.drawString(MARGIN + 24, Y(484), "1 : 35")
    par(MARGIN + 24, 512, "Un enseignant pour ~35 eleves — soit zero "
        "personnalisation reelle, et un decrochage cognitif detecte trop tard.",
        REG, 13, MUTE, 470, leading=19)

    # colonne droite : avant / apres
    x = 680; w = W - MARGIN - 680
    card(x, 170, w, 175, accent=RED)
    chip(x + 22, 188, "X  APPROCHE ACTUELLE", RED)
    title("Contenu uniforme pour tous", top=212, size=24, x=x + 22, maxw=w - 44)
    for i, t in enumerate(["Meme leçon, meme rythme pour 35 profils differents",
                           "Decrochage detecte tard, par l'echec",
                           "Orientation basee sur des notes, pas des donnees"]):
        c.setFillColor(RED); c.circle(x + 30, Y(264 + i * 26) + 4, 3, fill=1, stroke=0)
        par(x + 44, 258 + i * 26, t, REG, 12.5, MUTE, w - 70)

    card(x, 365, w, 205, accent=GREEN)
    chip(x + 22, 383, "OK  AVEC ADAPTLEARN", GREEN)
    title("Un parcours reecrit par eleve", top=407, size=24, x=x + 22, maxw=w - 44)
    for i, t in enumerate(["Chaque leçon adaptee au profil (modalite, rythme, langue)",
                           "Detection du decrochage en temps reel + intervention",
                           "Quiz adaptatifs (IRT) qui ajustent la difficulte",
                           "Orientation construite sur 6 ans de donnees reelles"]):
        c.setFillColor(GREEN); c.circle(x + 30, Y(459 + i * 26) + 4, 3, fill=1, stroke=0)
        par(x + 44, 453 + i * 26, t, REG, 12.5, WHITE, w - 70)
    footer(2)
    c.showPage()


# =====================================================================
# 03 — LES 7 QUESTIONS
# =====================================================================
def slide_seven():
    bg()
    header("SLIDE 03  .  FRAMEWORK")
    title("Les 7 questions du business model IA", accent_word="7 questions")
    par(MARGIN, 228, "Repondues pour AdaptLearn — chaque reponse valide la suivante.",
        REG, 14, MUTE, W - 2 * MARGIN)

    qs = [
        ("01", "Quel probleme ?", "Au primaire, l'enseignement uniforme creuse des ecarts d'apprentissage qui deviennent irreversibles.", GOLD),
        ("02", "Pour qui ?", "Ecoles publiques (B2G) et privees (B2B), parents (B2C) ; l'utilisateur final est l'eleve 6–12 ans.", BLUE),
        ("03", "Quelle valeur ?", "Temps d'enseignant rendu, decrochage reduit, progression mesurable, orientation fiable.", GREEN),
        ("04", "Comment l'IA cree la valeur ?", "Systeme multi-agents (LangGraph) : profilage par le jeu, reecriture de contenu, quiz IRT, orientation.", PINK),
        ("05", "Comment on gagne de l'argent ?", "Abonnement B2B par eleve/mois, licence par etablissement (B2G), premium familial a terme.", ORANGE),
        ("06", "Avantage competitif ?", "Donnees pedagogiques proprietaires + flywheel + validation enseignant (HITL) + multilingue.", PURPLE),
        ("07", "Comment scaler ?", "Cout marginal faible (~8 MAD/eleve), meme moteur multi-ecoles, fallback multi-LLM, contenu reutilisable.", GOLD),
    ]
    cols = 4
    cw = (W - 2 * MARGIN - (cols - 1) * 18) / cols
    ch = 188
    top0 = 250
    for i, (num, q, a, col) in enumerate(qs):
        r, cc = divmod(i, cols)
        x = MARGIN + cc * (cw + 18)
        top = top0 + r * (ch + 18)
        card(x, top, cw, ch, accent=col)
        c.setFillColor(col); c.setFont(BLD, 30)
        c.drawString(x + 18, Y(top + 48), num)
        par(x + 18, top + 70, q, BLD, 14.5, WHITE, cw - 36, leading=18)
        par(x + 18, top + 112, a, REG, 11.5, MUTE, cw - 36, leading=16)
    footer(3)
    c.showPage()


# =====================================================================
# 04 — PROPOSITION DE VALEUR
# =====================================================================
def slide_value():
    bg()
    header("SLIDE 04  .  FRAMEWORK PRATIQUE")
    title("Proposition de valeur", accent_word="valeur")
    par(MARGIN, 230,
        "Faire matcher ce que vit le client (profile) et ce qu'AdaptLearn "
        "lui apporte (value map).", REG, 15, MUTE, 500, leading=22)

    # exemple concret
    card(MARGIN, 330, 500, 240, accent=ORANGE)
    chip(MARGIN + 22, 348, "EXEMPLE CONCRET — ECOLE PRIMAIRE", ORANGE)
    par(MARGIN + 22, 380,
        "« Pour une ecole ou un enseignant gere 35 eleves...",
        BLD, 17, GOLDSOFT, 456, leading=23)
    par(MARGIN + 22, 432,
        "AdaptLearn reecrit chaque leçon selon le profil de l'enfant, detecte "
        "le decrochage en temps reel et remet a l'enseignant une file de "
        "validation. Contrairement a un manuel numerique, nous facturons a "
        "l'eleve actif — pas au siege. »",
        REG, 13, WHITE, 456, leading=19)

    # value map
    x = 620; w = 280
    card(x, 200, w, 240, accent=GOLD)
    chip(x + 18, 216, "VALUE MAP — SOLUTION IA", GOLD)
    rows = [("Produit IA", "tuteur adaptatif multi-agents"),
            ("Pain relievers", "personnalisation a grande echelle, sans surcharge prof"),
            ("Gain creators", "progression mesurable + orientation sur donnees")]
    yy = 250
    for k, v in rows:
        par(x + 18, yy, k, BLD, 13.5, WHITE, w - 36)
        yy = par(x + 18, yy + 20, v, REG, 11.5, MUTE, w - 36, leading=15) + 8

    # client profile
    x2 = 920; w2 = W - MARGIN - 920
    card(x2, 200, w2, 240, accent=BLUE)
    chip(x2 + 18, 216, "CLIENT PROFILE", BLUE)
    rows2 = [("Jobs", "instruire 35 eleves, suivre chacun, orienter"),
             ("Pains", "pas de temps, decrochage invisible, classes heterogenes"),
             ("Gains", "eleves qui progressent, parents rassures, donnees fiables")]
    yy = 250
    for k, v in rows2:
        par(x2 + 18, yy, k, BLD, 13.5, WHITE, w2 - 36)
        yy = par(x2 + 18, yy + 20, v, REG, 11.5, MUTE, w2 - 36, leading=15) + 8

    # FIT
    c.setFillColor(GOLD); c.setFont(BLD, 22)
    c.drawCentredString(620 + (W - MARGIN - 620) / 2, Y(490), "> > >   F I T   < < <")
    par(MARGIN, 525,
        "Product-market fit : chaque pain de l'ecole est adresse par au moins "
        "un pain reliever — et l'IA est indispensable a la solution, pas un gadget.",
        OBL, 13, MUTE, W - 2 * MARGIN, leading=19)
    footer(4)
    c.showPage()


# =====================================================================
# 05 — AI BUSINESS MODEL CANVAS
# =====================================================================
def slide_canvas():
    bg()
    header("SLIDE 05  .  AI BUSINESS MODEL CANVAS")
    title("Le canvas IA d'AdaptLearn — 9 blocs", size=40, accent_word="9 blocs")

    def block(x, top, w, h, lbl, col, head, body):
        card(x, top, w, h, accent=col)
        chip(x + 14, top + 14, lbl, col)
        par(x + 14, top + 34, head, BLD, 12.5, WHITE, w - 28, leading=15)
        par(x + 14, top + 34 + 16 * (len(wrap(head, BLD, 12.5, w - 28))) + 4,
            body, REG, 10, MUTE, w - 28, leading=13)

    top = 210
    rowh = 132
    colw = (W - 2 * MARGIN - 4 * 14) / 5

    xs = [MARGIN + i * (colw + 14) for i in range(5)]
    # rangee 1
    block(xs[0], top, colw, rowh, "DONNEES", BLUE, "Sources & qualite",
          "Profils, telemetrie, resultats quiz, contenu enseignant (RAG pgvector). RGPD / loi 09-08.")
    block(xs[1], top, colw, rowh, "RESSOURCES IA", TEAL, "Modeles & talents",
          "LangGraph, Gemini 2.5 + Groq fallback, embeddings, ingenieurs IA, cloud.")
    block(xs[2], top, colw, rowh * 2 + 14, "PROPOSITION DE VALEUR", GOLD,
          "Un tuteur adaptatif par enfant",
          "Contenu reecrit par profil, quiz IRT, monitoring temps reel et orientation sur donnees reelles — impossible a la main.")
    block(xs[3], top, colw, rowh, "SEGMENTS CLIENTS", PINK, "Pour qui ?",
          "Ecoles publiques (B2G), ecoles privees (B2B), parents (B2C, long terme).")
    block(xs[4], top, colw, rowh, "CANAUX & RELATIONS", ORANGE, "Acquisition",
          "Ventes B2B, pilotes academies, demos ecoles, bouche-a-oreille parents.")
    # rangee 2
    top2 = top + rowh + 14
    block(xs[0], top2, colw, rowh, "ACTIVITES CLES", PURPLE, "Adapter . Suivre . Valider",
          "Profilage, adaptation, monitoring, examens, file HITL enseignant.")
    block(xs[1], top2, colw, rowh, "LEARNING LOOP", GOLD, "Boucle d'apprentissage",
          "Chaque interaction affine le profil et le contenu de l'eleve.")
    block(xs[3], top2, colw, rowh, "PARTENAIRES CLES", BLUE, "Ecosysteme",
          "MEN / Academies, ecoles, fournisseurs LLM (Gemini, Groq, HF), hebergeurs Maroc.")
    block(xs[4], top2, colw, rowh, "KPI & CONFIANCE", GREEN, "Mesurer la confiance",
          "Maitrise, engagement, NPS, conformite, biais, taux de validation prof.")
    # bandeau couts / revenus
    top3 = top2 + rowh + 14
    halfw = (W - 2 * MARGIN - 14) / 2
    block(MARGIN, top3, halfw, 86, "STRUCTURE DE COUTS", RED, "Inference & data = vrais postes",
          "LLM . TTS . visuels . infra cloud . talent IA  ~  8,25 MAD / eleve / mois.")
    block(MARGIN + halfw + 14, top3, halfw, 86, "SOURCES DE REVENUS", GREEN, "Au-dela de l'abonnement",
          "B2B 30 MAD/eleve . B2G 15 MAD . premium familial . marge brute ~73%.")
    footer(5)
    c.showPage()


# =====================================================================
# 06 — DATA FLYWHEEL
# =====================================================================
def slide_flywheel():
    bg()
    header("SLIDE 06  .  CYCLE DE VALEUR")
    title("Le Data Flywheel d'AdaptLearn", accent_word="Data Flywheel")
    par(MARGIN, 290,
        "Plus d'eleves > plus de signaux > meilleurs profils & contenu > "
        "meilleure experience > encore plus d'ecoles et d'eleves.",
        REG, 15, MUTE, 480, leading=24)

    card(MARGIN, 410, 480, 160, accent=GOLD, fill=PANEL)
    par(MARGIN + 22, 438,
        "« Le contenu d'AdaptLearn s'ameliore a chaque enfant qui "
        "apprend. C'est la boucle d'auto-renforcement qui cree un vrai moat "
        "pedagogique. »", OBL, 15, WHITE, 436, leading=22)

    # roue
    cx, cy, R = 970, Y(400), 150
    c.setFillColor(ORANGE)
    c.circle(cx, cy, 56, fill=1, stroke=0)
    c.setFillColor(BG); c.setFont(BLD, 15)
    c.drawCentredString(cx, cy + 4, "DATA")
    c.drawCentredString(cx, cy - 14, "FLYWHEEL")

    nodes = [("01 ELEVES", "jouent & apprennent", GOLD, 90),
             ("02 SIGNAUX", "jeux, quiz, telemetrie", BLUE, 18),
             ("03 MODELE", "profils + contenu affines", TEAL, -54),
             ("04 PRODUIT", "+ precis, + personnel", PINK, -126),
             ("05 VALEUR", "attire + d'ecoles", ORANGE, 162)]
    import math
    for lbl, sub, col, ang in nodes:
        a = math.radians(ang)
        nx, ny = cx + R * math.cos(a), cy + R * math.sin(a)
        c.setFillColor(PANEL); c.setStrokeColor(col); c.setLineWidth(1.5)
        c.roundRect(nx - 78, ny - 26, 156, 52, 8, fill=1, stroke=1)
        c.setFillColor(col); c.setFont(BLD, 11)
        c.drawCentredString(nx, ny + 6, lbl)
        c.setFillColor(MUTE); c.setFont(REG, 9)
        c.drawCentredString(nx, ny - 10, sub)
    footer(6)
    c.showPage()


# =====================================================================
# 07 — MODELE ECONOMIQUE & UNIT ECONOMICS
# =====================================================================
def slide_econ():
    bg()
    header("SLIDE 07  .  MODELE ECONOMIQUE")
    title("Comment AdaptLearn gagne de l'argent", size=40, accent_word="gagne")

    # modele choisi
    par(MARGIN, 215, "MODELE RETENU", BLD, 11, GOLD, 500)
    par(MARGIN, 238,
        "SaaS IA en B2B2C : on vend l'acces a un tuteur adaptatif, facture a "
        "l'eleve actif. A terme, une brique outcome (paiement lie a la "
        "progression mesuree) renforce l'alignement avec les ecoles.",
        REG, 14, MUTE, 540, leading=21)

    # 3 niveaux de prix
    tiers = [("B2G — PUBLIC", "Licence par etablissement", "~15 MAD / eleve / mois", BLUE),
             ("B2B — PRIVE", "Abonnement par classe", "~30 MAD / eleve / mois", GOLD),
             ("B2C — PARENTS", "Freemium + premium familial", "long terme", PINK)]
    yy = 360
    for lbl, desc, price, col in tiers:
        card(MARGIN, yy, 540, 64, accent=col)
        chip(MARGIN + 18, yy + 14, lbl, col)
        par(MARGIN + 18, yy + 38, desc, REG, 12.5, WHITE, 360)
        c.setFillColor(col); c.setFont(BLD, 15)
        c.drawRightString(MARGIN + 522, Y(yy + 40), price)
        yy += 74

    # unit economics
    x = 640; w = W - MARGIN - 640
    card(x, 200, w, 370, accent=GREEN)
    chip(x + 22, 220, "UNIT ECONOMICS — LE CHIFFRE QUI COMPTE", GREEN)
    par(x + 22, 250, "Par eleve actif / mois", REG, 12, MUTE, w - 44)
    rows = [("LLM (adaptation + quiz + orientation)", "1,70 MAD"),
            ("TTS (lecture audio)", "4,00 MAD"),
            ("Visuels (FLUX)", "1,00 MAD"),
            ("Embeddings + infra amortie", "1,55 MAD")]
    yy = 286
    c.setStrokeColor(PANEL2); c.setLineWidth(1)
    for k, v in rows:
        par(x + 22, yy, k, REG, 12.5, WHITE, w - 160)
        c.setFillColor(GOLDSOFT); c.setFont(BLD, 12.5)
        c.drawRightString(x + w - 22, Y(yy + 10), v)
        c.line(x + 22, Y(yy + 22), x + w - 22, Y(yy + 22))
        yy += 34
    # total
    c.setFillColor(WHITE); c.setFont(BLD, 14)
    c.drawString(x + 22, Y(yy + 14), "COGS total")
    c.setFillColor(RED); c.setFont(BLD, 16)
    c.drawRightString(x + w - 22, Y(yy + 14), "~ 8,25 MAD")
    yy += 44
    c.setFillColor(WHITE); c.setFont(BLD, 14)
    c.drawString(x + 22, Y(yy + 14), "Prix de vente B2B")
    c.setFillColor(GREEN); c.setFont(BLD, 16)
    c.drawRightString(x + w - 22, Y(yy + 14), "~ 30 MAD")
    yy += 40
    card(x + 18, yy + 4, w - 36, 50, fill=PANEL2)
    c.setFillColor(GOLD); c.setFont(BLD, 22)
    c.drawCentredString(x + w / 2, Y(yy + 38), "Marge brute ~ 73 %")
    footer(7)
    c.showPage()


# =====================================================================
# 08 — MARCHE & SCENARIOS
# =====================================================================
def slide_market():
    bg()
    header("SLIDE 08  .  MARCHE & TRACTION")
    title("Marche & scenarios de revenus", accent_word="Marche")

    # TAM SAM SOM
    funnel = [("TAM", "~4 M eleves au primaire (public + prive, Maroc)", BLUE, 540),
              ("SAM", "~500 k eleves du prive + ecoles connectees", TEAL, 420),
              ("SOM (24 mois)", "20 k eleves — 40 ecoles + 1 academie pilote", GOLD, 300)]
    yy = 230
    for lbl, desc, col, bw in funnel:
        card(MARGIN, yy, bw, 70, accent=col)
        chip(MARGIN + 18, yy + 16, lbl, col)
        par(MARGIN + 18, yy + 40, desc, REG, 12.5, WHITE, bw - 36, leading=16)
        yy += 86

    # scenarios
    x = 640; w = W - MARGIN - 640
    card(x, 200, w, 230, accent=GOLD)
    chip(x + 22, 218, "SCENARIOS — ARR A 24 MOIS", GOLD)
    sc = [("Conservateur", "5 000 eleves (10 ecoles)", "1,8 M MAD", MUTE),
          ("Base (cible)", "20 000 eleves (40 ecoles + academie)", "7,2 M MAD", GOLD),
          ("Optimiste", "60 000 eleves (contrat MEN regional)", "21,6 M MAD", GREEN)]
    yy = 252
    for k, v, arr, col in sc:
        c.setFillColor(col); c.setFont(BLD, 13.5)
        c.drawString(x + 22, Y(yy + 12), k)
        par(x + 22, yy + 22, v, REG, 11, MUTE, w - 170)
        c.setFillColor(col); c.setFont(BLD, 15)
        c.drawRightString(x + w - 22, Y(yy + 14), arr)
        yy += 52
    par(x + 22, yy + 6, "Break-even operationnel : ~12 000 eleves actifs (~mois 20).",
        OBL, 11.5, MUTE, w - 44)

    # financement
    card(x, 450, w, 120, accent=ORANGE)
    chip(x + 22, 468, "FINANCEMENT", ORANGE)
    par(x + 22, 494, "Phase 1 (pilote 3 ecoles) : 331 k MAD.  Besoin total ~ "
        "3,9 M MAD sur 24 mois (seed > VC local > scale).",
        REG, 13, WHITE, w - 44, leading=19)
    footer(8)
    c.showPage()


# =====================================================================
# 09 — AVANTAGE COMPETITIF
# =====================================================================
def slide_moat():
    bg()
    header("SLIDE 09  .  AVANTAGE COMPETITIF")
    title("Pourquoi nous, pourquoi maintenant", accent_word="Pourquoi")

    moats = [
        ("Donnees proprietaires", "6 ans de signaux d'apprentissage par eleve — irreplicables par un nouvel entrant.", BLUE),
        ("Data flywheel", "Le produit s'ameliore tout seul : chaque enfant rend le modele meilleur.", TEAL),
        ("Confiance & HITL", "Validation enseignant + conformite : condition d'adoption B2G/B2B.", GREEN),
        ("Multilingue local", "FR / Darija / Arabe : barriere reelle pour les acteurs etrangers.", PURPLE),
        ("Cout maitrise", "Fallback multi-LLM (Groq + Gemini) deja code — COGS sous controle.", ORANGE),
        ("Timing", "LLM devenus abordables + digitalisation de l'education au Maroc.", GOLD),
    ]
    cols = 3
    cw = (W - 2 * MARGIN - (cols - 1) * 18) / cols
    ch = 150
    top0 = 230
    for i, (h, b, col) in enumerate(moats):
        r, cc = divmod(i, cols)
        x = MARGIN + cc * (cw + 18)
        top = top0 + r * (ch + 20)
        card(x, top, cw, ch, accent=col)
        par(x + 18, top + 30, h, BLD, 17, WHITE, cw - 36, leading=21)
        par(x + 18, top + 74, b, REG, 12.5, MUTE, cw - 36, leading=18)
    footer(9)
    c.showPage()


# =====================================================================
# 10 — LES 5 ERREURS EVITEES
# =====================================================================
def slide_antipatterns():
    bg()
    header("SLIDE 10  .  ANTI-PATTERNS")
    title("Les 5 erreurs qu'on evite", accent_word="5 erreurs")
    par(MARGIN, 228, "Les pieges qui tuent une startup IA — et comment AdaptLearn les desamorce.",
        REG, 14, MUTE, W - 2 * MARGIN)

    rows = [
        ("01", "Construire la tech avant le besoin", "On part d'un pain valide : les ecoles ne peuvent pas personnaliser.", RED),
        ("02", "Oublier le client", "4 roles produits (eleve, prof, parent, admin) + file de validation enseignant.", ORANGE),
        ("03", "Ignorer le cout d'inference", "COGS 8 MAD < prix 30 MAD ; fallback multi-LLM contre les marges negatives.", GOLD),
        ("04", "Aucune differenciation", "Donnees proprietaires + flywheel + multilingue — pas un simple wrapper GPT.", PURPLE),
        ("05", "Pas de strategie data", "Donnees structurees, conformes (09-08), capitalisees : le flywheel est le moat.", GREEN),
    ]
    yy = 250
    for num, h, b, col in rows:
        card(MARGIN, yy, W - 2 * MARGIN, 70, fill=PANEL)
        c.setFillColor(col); c.roundRect(MARGIN, Y(yy + 70), 6, 70, 3, fill=1, stroke=0)
        c.setFillColor(col); c.setFont(BLD, 28)
        c.drawString(MARGIN + 26, Y(yy + 46), num)
        par(MARGIN + 100, yy + 20, h, BLD, 16, WHITE, 520)
        par(MARGIN + 640, yy + 22, b, REG, 12.5, MUTE, W - MARGIN - 640 - 24, leading=17)
        yy += 80
    footer(10)
    c.showPage()


# =====================================================================
# 11 — PITCH JURY 1-SLIDE
# =====================================================================
def slide_pitch():
    bg()
    header("SLIDE 11  .  PITCH 1-SLIDE")
    title("AdaptLearn en une slide", accent_word="une slide")

    rows = [
        ("01", "PROBLEME", "Au primaire, 1 prof pour ~35 eleves ne peut pas personnaliser — les ecarts se cumulent sur 6 ans.", RED),
        ("02", "SOLUTION", "AdaptLearn transforme chaque leçon en parcours personnalise grace a un systeme multi-agents qui apprend de chaque enfant.", GREEN),
        ("03", "MARCHE", "~4 M eleves (TAM Maroc) . 500 k prive (SAM) . 20 k vises a 24 mois (SOM).", BLUE),
        ("04", "MODELE ECONOMIQUE", "SaaS B2B2C, 30 MAD/eleve/mois, COGS 8 MAD, marge ~73%, ARR cible 7,2 M MAD a 24 mois.", GOLD),
        ("05", "AVANTAGE", "Donnees proprietaires + flywheel + HITL + multilingue. Maintenant : LLM abordables + ecole qui se digitalise.", ORANGE),
    ]
    yy = 210
    for num, lbl, b, col in rows:
        card(MARGIN, yy, W - 2 * MARGIN, 82, fill=PANEL)
        c.setFillColor(col); c.roundRect(MARGIN, Y(yy + 82), 6, 82, 3, fill=1, stroke=0)
        c.setFillColor(col); c.setFont(BLD, 30)
        c.drawString(MARGIN + 28, Y(yy + 52), num)
        chip(MARGIN + 110, yy + 22, lbl, col)
        par(MARGIN + 110, yy + 46, b, BLD, 15, WHITE, W - 2 * MARGIN - 150, leading=20)
        yy += 92
    footer(11)
    c.showPage()


# =====================================================================
# 12 — CLOTURE
# =====================================================================
def slide_close():
    bg()
    c.setFillColor(PANEL2); c.rect(W - 420, 0, 420, H, fill=1, stroke=0)
    c.setFillColor(GOLD); c.rect(0, 0, 8, H, fill=1, stroke=0)
    header("SLIDE 12  .  LES 3 MESSAGES A RETENIR")
    title("Construisez la valeur, pas la tech.", top=170, size=50,
          accent_word="valeur", maxw=760)

    msgs = [("01", "PRINCIPE FONDATEUR", "« Ne construisez pas une IA. Construisez un parcours d'apprentissage. »", GOLD),
            ("02", "PRINCIPE DE VALEUR", "« L'IA est le moteur. L'enfant qui progresse est la valeur. »", ORANGE),
            ("03", "PRINCIPE D'IMPACT", "« Le futur de l'education appartient a ceux qui transforment la donnee en progression. »", GREEN)]
    yy = 320
    for num, lbl, m, col in msgs:
        c.setFillColor(col); c.roundRect(MARGIN, Y(yy + 78), 6, 78, 3, fill=1, stroke=0)
        c.setFillColor(col); c.setFont(BLD, 28)
        c.drawString(MARGIN + 26, Y(yy + 44), num)
        chip(MARGIN + 100, yy + 14, lbl, col)
        par(MARGIN + 100, yy + 40, m, BLD, 18, WHITE, 660, leading=24)
        yy += 96
    brandmark(MARGIN, 640)
    footer(12)
    c.showPage()


# ---- build ----
slide_cover()
slide_problem()
slide_seven()
slide_value()
slide_canvas()
slide_flywheel()
slide_econ()
slide_market()
slide_moat()
slide_antipatterns()
slide_pitch()
slide_close()
c.save()
print("OK -> business-model-ia-adaptlearn.pdf")

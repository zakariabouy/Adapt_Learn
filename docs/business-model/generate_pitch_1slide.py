# -*- coding: utf-8 -*-
"""
AdaptLearn — Pitch jury 1 slide (format RallyIA / Orange Digital Center, slide 14).
Cinq informations lisibles d'un coup d'oeil : Probleme, Solution, Marche,
Modele economique, Avantage competitif. Page A4 paysage, sobre et claire.
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import Paragraph, Frame
from reportlab.pdfgen import canvas as canvas_mod

# ---- palette sobre ----
INK   = colors.HexColor("#14181F")
GREY  = colors.HexColor("#5A6472")
LINE  = colors.HexColor("#D9DEE6")
ACCENT= colors.HexColor("#1F4E79")
SOFT  = colors.HexColor("#F4F6F9")

W, H = A4[1], A4[0]   # paysage
M = 16 * mm

c = canvas_mod.Canvas("pitch-1slide-adaptlearn.pdf", pagesize=(W, H),
                      bottomup=1)
c.setTitle("AdaptLearn - Pitch jury 1 slide")


def para(text, font, size, color, leading=None):
    return Paragraph(text, ParagraphStyle(
        "x", fontName=font, fontSize=size, textColor=color,
        leading=leading or size + 3, alignment=TA_LEFT))


def draw_para(p, x, y_top, w, h):
    """Draw a Paragraph in a box whose TOP is at y_top (top-origin coords)."""
    fw, fh = p.wrap(w, h)
    p.drawOn(c, x, H - y_top - fh)
    return fh


# ---------- background ----------
c.setFillColor(colors.white)
c.rect(0, 0, W, H, fill=1, stroke=0)
# left accent rail
c.setFillColor(ACCENT)
c.rect(0, 0, 6, H, fill=1, stroke=0)

# ---------- header ----------
top = M
draw_para(para("AdaptLearn", "Helvetica-Bold", 30, INK), M, top, W - 2 * M, 40)
draw_para(para("Apprentissage adaptatif par IA pour le primaire (6–12 ans) — Maroc",
               "Helvetica", 12.5, GREY), M, top + 34, W - 2 * M, 20)
# rule
c.setStrokeColor(LINE); c.setLineWidth(0.8)
c.line(M, H - (top + 58), W - M, H - (top + 58))

# ---------- five blocks ----------
blocks = [
    ("01", "PROBLÈME",
     "Au primaire, <b>1 enseignant pour ~35 élèves</b> ne peut pas personnaliser — "
     "les écarts pris tôt se cumulent sur les 6 années du cycle.", colors.HexColor("#C0392B")),
    ("02", "SOLUTION",
     "AdaptLearn transforme <b>chaque leçon en un parcours personnalisé</b> grâce à un "
     "système <b>multi-agents</b> qui profile l'enfant par le jeu et apprend de lui.", colors.HexColor("#1E8449")),
    ("03", "MARCHÉ",
     "<b>~4 M</b> élèves au primaire (TAM Maroc) · <b>~500 k</b> dans le privé (SAM) · "
     "<b>20 k</b> visés à 24 mois : 40 écoles + 1 académie pilote (SOM).", colors.HexColor("#1F618D")),
    ("04", "MODÈLE ÉCONOMIQUE",
     "<b>SaaS B2B2C</b> — ~30 MAD/élève/mois · COGS ~8 MAD · <b>marge ~73 %</b> · "
     "ARR cible <b>7,2 M MAD</b> à 24 mois.", colors.HexColor("#B9770E")),
    ("05", "AVANTAGE COMPÉTITIF",
     "Données pédagogiques <b>propriétaires</b> + <b>data flywheel</b> + validation enseignant "
     "(HITL) + <b>multilingue</b> (FR/Darija/Arabe). Pourquoi maintenant : LLM abordables + école qui se digitalise.",
     colors.HexColor("#6C3483")),
]

block_top = top + 76
row_h = (H - block_top - M - 26) / len(blocks)   # leave room for footer line
num_w = 42
for num, label, body, col in blocks:
    y = block_top
    # number chip
    c.setFillColor(col)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(M + 4, H - (y + 24), num)
    # color tick
    c.setFillColor(col)
    c.rect(M, H - (y + row_h - 8), 3, row_h - 16, fill=1, stroke=0)
    # label
    draw_para(para(label, "Helvetica-Bold", 10.5, col), M + num_w + 8, y + 2, W - 2 * M - num_w - 8, 16)
    # body
    draw_para(para(body, "Helvetica", 13.5, INK, leading=18),
              M + num_w + 8, y + 18, W - 2 * M - num_w - 8, row_h)
    # separator
    c.setStrokeColor(LINE); c.setLineWidth(0.5)
    c.line(M + num_w + 8, H - (block_top + (blocks.index((num, label, body, col)) + 1) * row_h) + 6,
           W - M, H - (block_top + (blocks.index((num, label, body, col)) + 1) * row_h) + 6)
    block_top += row_h

# ---------- footer punchline ----------
c.setFillColor(SOFT)
c.rect(M, M - 4, W - 2 * M, 22, fill=1, stroke=0)
draw_para(para("« Je vois ce que ça change, et je sais comment ça gagne de l'argent. »",
               "Helvetica-Oblique", 11.5, ACCENT), M + 10, H - M - 14, W - 2 * M - 20, 18)

c.showPage()
c.save()
print("OK -> pitch-1slide-adaptlearn.pdf")

#!/usr/bin/env python3
"""Draw the ShopStore counter workflow as a coloured multi-page diagram."""

import math
import sys
from pathlib import Path

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.colors import Color, HexColor, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas

PAGE = landscape(A4)
W, H = PAGE

INK = HexColor("#1c1915")
PAPER = HexColor("#f6f1e7")
MUTED = HexColor("#5c564c")
LINE = HexColor("#292524")

TEAL = HexColor("#0f766e")
BLUE = HexColor("#1d4ed8")
GREEN = HexColor("#166534")
VIOLET = HexColor("#6d28d9")
AMBER = HexColor("#b45309")
RUST = HexColor("#c2410c")
RED = HexColor("#b91c1c")
NAVY = HexColor("#1e3a8a")


def set_fill(c, color):
    c.setFillColor(color)


def rounded(c, x, y, w, h, fill, radius=12):
    c.setFillColor(fill)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=0)


def arrow(c, x1, y1, x2, y2, color=LINE, weight=2.4, head=11):
    angle = math.atan2(y2 - y1, x2 - x1)
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(weight)
    c.setLineCap(1)
    c.line(
        x1,
        y1,
        x2 - math.cos(angle) * head * 0.55,
        y2 - math.sin(angle) * head * 0.55,
    )
    path = c.beginPath()
    path.moveTo(x2, y2)
    path.lineTo(
        x2 - head * math.cos(angle) + head * 0.42 * math.sin(angle),
        y2 - head * math.sin(angle) - head * 0.42 * math.cos(angle),
    )
    path.lineTo(
        x2 - head * math.cos(angle) - head * 0.42 * math.sin(angle),
        y2 - head * math.sin(angle) + head * 0.42 * math.cos(angle),
    )
    path.close()
    c.drawPath(path, fill=1, stroke=0)


def poly_arrow(c, points, color=LINE, weight=2.4, head=11):
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(weight)
    c.setLineCap(1)
    c.setLineJoin(1)
    path = c.beginPath()
    path.moveTo(points[0][0], points[0][1])
    for x, y in points[1:-1]:
        path.lineTo(x, y)
    last_x, last_y = points[-1]
    prev_x, prev_y = points[-2]
    angle = math.atan2(last_y - prev_y, last_x - prev_x)
    path.lineTo(
        last_x - math.cos(angle) * head * 0.55,
        last_y - math.sin(angle) * head * 0.55,
    )
    c.drawPath(path, stroke=1, fill=0)
    tip = c.beginPath()
    tip.moveTo(last_x, last_y)
    tip.lineTo(
        last_x - head * math.cos(angle) + head * 0.42 * math.sin(angle),
        last_y - head * math.sin(angle) - head * 0.42 * math.cos(angle),
    )
    tip.lineTo(
        last_x - head * math.cos(angle) - head * 0.42 * math.sin(angle),
        last_y - head * math.sin(angle) + head * 0.42 * math.cos(angle),
    )
    tip.close()
    c.drawPath(tip, fill=1, stroke=0)


def pill(c, x, y, text, fill=HexColor("#fff7ed"), ink=INK):
    c.setFont("Helvetica-Bold", 8)
    width = c.stringWidth(text, "Helvetica-Bold", 8) + 14
    rounded(c, x, y, width, 16, fill, 8)
    c.setFillColor(ink)
    c.drawString(x + 7, y + 4.5, text)
    return width


def centered_pill(c, left, right, y, text, fill, ink):
    c.setFont("Helvetica-Bold", 8)
    width = c.stringWidth(text, "Helvetica-Bold", 8) + 14
    pill(c, left + (right - left - width) / 2, y, text, fill, ink)


def footer(c, page, total):
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8)
    c.drawString(28, 18, "ShopStore  ·  fertiliser counter  ·  stock only  ·  Rohan Dalal")
    label = f"{page} / {total}"
    c.drawRightString(W - 28, 18, label)


def header(c, kicker, title, subtitle):
    c.setFillColor(HexColor("#14532d"))
    c.rect(0, H - 78, W, 78, fill=1, stroke=0)
    c.setFillColor(HexColor("#bbf7d0"))
    c.setFont("Helvetica-Bold", 9)
    c.drawString(28, H - 24, kicker.upper())
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(28, H - 48, title)
    c.setFillColor(HexColor("#d1fae5"))
    c.setFont("Helvetica", 10)
    c.drawString(28, H - 66, subtitle)


def card(c, x, y, w, h, fill, eyebrow, title, lines):
    rounded(c, x, y, w, h, fill, 14)
    c.setFillColor(HexColor("#ecfdf5") if fill != AMBER else HexColor("#fffbeb"))
    if fill in (TEAL, BLUE, GREEN, VIOLET, NAVY, RUST, RED, AMBER, HexColor("#0f766e")):
        c.setFillColor(white)
    c.setFillColor(HexColor("#ffffff"))
    c.setFillColor(Color(1, 1, 1, alpha=0.92))
    # eyebrow sits on the colour; text is white for saturated cards
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x + 14, y + h - 20, eyebrow.upper())
    c.setFont("Helvetica-Bold", 13)
    title_y = y + h - 40
    for part in title if isinstance(title, list) else [title]:
        c.drawString(x + 14, title_y, part)
        title_y -= 16
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#f8fafc"))
    cursor = title_y - 6
    for line in lines:
        c.drawString(x + 14, cursor, line)
        cursor -= 13


def page_system(c):
    c.setFillColor(PAPER)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    header(
        c,
        "System map",
        "ShopStore — where the counter talks to the book",
        "Next.js + Tailwind in the browser. Node.js API on Render. MongoDB holds the stock.",
    )

    box_w, box_h = 210, 168
    y = 146
    gap = 78
    x1 = 46
    x2 = x1 + box_w + gap
    x3 = x2 + box_w + gap

    card(
        c,
        x1,
        y,
        box_w,
        box_h,
        TEAL,
        "Counter screen",
        "Next.js + Tailwind",
        [
            "Dashboard, products,",
            "stock in, stock out,",
            "purchase and sales",
            "registers.",
            "Big type. Few fields.",
            "Dev port 43123.",
        ],
    )
    card(
        c,
        x2,
        y,
        box_w,
        box_h,
        BLUE,
        "Stock API",
        "Node.js + Express",
        [
            "Mongoose models.",
            "Categories, products,",
            "purchase vouchers,",
            "sale vouchers.",
            "No login. No GST.",
            "Dev port 43121.",
        ],
    )
    card(
        c,
        x3,
        y,
        box_w,
        box_h,
        GREEN,
        "Stock documents",
        "MongoDB",
        [
            "Category",
            "Product — qty, CP, SP",
            "Purchase voucher",
            "Sale voucher",
            "Qty lives on the",
            "product.",
        ],
    )

    arrow(c, x1 + box_w + 6, y + box_h / 2, x2 - 6, y + box_h / 2, TEAL)
    pill(c, x1 + box_w + 14, y + box_h / 2 + 12, "HTTP JSON", HexColor("#ccfbf1"), TEAL)

    arrow(c, x2 + box_w + 6, y + box_h / 2, x3 - 6, y + box_h / 2, BLUE)
    pill(c, x2 + box_w + 8, y + box_h / 2 + 12, "read / write", HexColor("#dbeafe"), BLUE)

    render_w, render_h = 230, 72
    render_x = x2 + (box_w - render_w) / 2
    render_y = y + box_h + 72
    card(
        c,
        render_x,
        render_y,
        render_w,
        render_h,
        VIOLET,
        "Backend deploy target",
        "Render",
        ["Env: MONGODB_URI, CORS_ORIGIN", "Health check: /health"],
    )
    arrow(
        c,
        x2 + box_w / 2,
        render_y,
        x2 + box_w / 2,
        y + box_h + 8,
        VIOLET,
    )
    pill(c, x2 + 16, y + box_h + 28, "runs the API", HexColor("#ede9fe"), VIOLET)

    rounded(c, 46, 40, W - 92, 92, white, 12)
    c.setStrokeColor(HexColor("#e7e5e4"))
    c.setLineWidth(1)
    c.roundRect(46, 40, W - 92, 92, 12, fill=0, stroke=1)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(64, 110, "What the counter does not keep in this book")
    chips = [
        (64, "No accounts ledger"),
        (230, "No GST invoice"),
        (390, "No login"),
        (510, "Stock in and stock out only"),
    ]
    for x, label in chips:
        pill(c, x, 68, label, HexColor("#f5f5f4"), MUTED)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9)
    c.drawString(64, 50, "B2B counter staff. Plain screens. The bag count and the two prices are the whole job.")
    footer(c, 1, 3)


def flow_card(c, x, y, w, h, fill, number, title, lines):
    rounded(c, x, y, w, h, fill, 14)
    c.setFillColor(white)
    c.circle(x + 22, y + h - 22, 12, fill=1, stroke=0)
    c.setFillColor(fill)
    c.setFont("Helvetica-Bold", 12)
    label = str(number)
    c.drawCentredString(x + 22, y + h - 26, label)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(x + 42, y + h - 28, title)
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#f8fafc"))
    cursor = y + h - 52
    for line in lines:
        c.drawString(x + 16, cursor, line)
        cursor -= 14


def page_flow(c):
    c.setFillColor(PAPER)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    header(
        c,
        "Ordered stock flow",
        "Five steps from the product card to a reversed voucher",
        "Short labels on each box say what the counter just did to the godown.",
    )

    bw, bh = 198, 156
    gap = 92
    y_top = 328
    y_bot = 58
    x1 = 32
    x2 = x1 + bw + gap
    x3 = x2 + bw + gap

    flow_card(
        c,
        x1,
        y_top,
        bw,
        bh,
        NAVY,
        1,
        "Categories & products",
        [
            "Group the godown",
            "Unit, cost price, selling price",
            "Opening qty sits on the product",
            "Five fertiliser groups",
        ],
    )
    flow_card(
        c,
        x2,
        y_top,
        bw,
        bh,
        GREEN,
        2,
        "Stock in / purchase",
        [
            "Supplier name and date",
            "Line: product, qty, CP",
            "Stock increases",
            "Latest CP saved from this rate",
        ],
    )
    flow_card(
        c,
        x3,
        y_top,
        bw,
        bh,
        AMBER,
        3,
        "Stock on hand",
        [
            "Bags still in the godown",
            "Value at cost price (CP)",
            "Value at selling price (SP)",
            "Low stock flagged",
        ],
    )
    flow_card(
        c,
        x3,
        y_bot,
        bw,
        bh,
        RUST,
        4,
        "Stock out / sale",
        [
            "Customer shop name and date",
            "Line: product, qty, SP",
            "Stock decreases",
            "Margin shown (SP − CP)",
        ],
    )
    flow_card(
        c,
        x2,
        y_bot,
        bw,
        bh,
        RED,
        5,
        "Delete a wrong voucher",
        [
            "Delete sale: stock comes back",
            "Delete purchase: stock goes down",
            "Purchase delete only if enough",
            "qty is still on hand",
        ],
    )

    mid = y_top + bh / 2
    arrow(c, x1 + bw + 6, mid, x2 - 6, mid, NAVY)
    centered_pill(c, x1 + bw, x2, mid + 8, "set up", HexColor("#dbeafe"), NAVY)

    arrow(c, x2 + bw + 6, mid, x3 - 6, mid, GREEN)
    centered_pill(c, x2 + bw, x3, mid + 8, "qty up, CP set", HexColor("#dcfce7"), GREEN)

    arrow(c, x3 + bw - 24, y_top - 8, x3 + bw - 24, y_bot + bh + 8, AMBER)
    centered_pill(
        c,
        x3,
        x3 + bw - 36,
        y_bot + bh + 36,
        "sell from on-hand",
        HexColor("#ffedd5"),
        AMBER,
    )

    low = y_bot + bh / 2
    arrow(c, x3 - 6, low, x2 + bw + 6, low, RUST)
    centered_pill(c, x2 + bw, x3, low + 8, "wrong entry", HexColor("#fee2e2"), RED)

    footer(c, 2, 3)


def rule_card(c, x, y, w, h, fill, title, body):
    rounded(c, x, y, w, h, fill, 14)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(x + 16, y + h - 28, title)
    c.setFont("Helvetica", 10)
    cursor = y + h - 50
    for line in body:
        c.drawString(x + 16, cursor, line)
        cursor -= 15


def mini(c, x, y, w, h, fill, lines):
    rounded(c, x, y, w, h, fill, 10)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 8)
    cursor = y + h - 16
    for i, line in enumerate(lines):
        c.setFont("Helvetica-Bold" if i == 0 else "Helvetica", 8)
        c.drawString(x + 8, cursor, line)
        cursor -= 11


def page_rules(c):
    c.setFillColor(PAPER)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    header(
        c,
        "Counter rules",
        "What the book refuses, and what a delete puts back",
        "Urea 46% N, 45 kg bag — one morning, so the arrows have numbers on them.",
    )

    rw, rh = 370, 112
    rule_card(
        c,
        36,
        360,
        rw,
        rh,
        RUST,
        "Cannot sell more than stock",
        [
            "Ask for 20 bags when 12 are on hand.",
            "The sale is refused. Qty stays 12.",
            "The selling price is not changed.",
        ],
    )
    rule_card(
        c,
        430,
        360,
        rw,
        rh,
        GREEN,
        "Delete sale restores stock",
        [
            "A wrong shop name on the voucher.",
            "Delete it. The bags return to the godown.",
            "The posted SP stays as the latest rate.",
        ],
    )
    rule_card(
        c,
        36,
        232,
        rw,
        rh,
        RED,
        "Delete purchase only if stock remains",
        [
            "The voucher put 20 bags in.",
            "If 15 were already sold, delete is refused.",
            "Stock and the voucher both stay as they are.",
        ],
    )
    rule_card(
        c,
        430,
        232,
        rw,
        rh,
        AMBER,
        "Latest CP / SP comes from the voucher",
        [
            "Purchase rate becomes the product CP.",
            "Sale rate becomes the product SP.",
            "The last line on the voucher wins.",
        ],
    )

    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(36, 206, "Worked urea line")

    chips = [
        (36, TEAL, ["Start", "10 bags", "CP 242  SP 266.50"]),
        (196, GREEN, ["Stock in +20", "at CP 250", "now 30 bags"]),
        (356, AMBER, ["On hand", "value CP 7,500", "value SP 7,995"]),
        (516, RUST, ["Stock out 8", "at SP 270", "margin 160"]),
        (676, NAVY, ["After sale", "22 bags left", "SP now 270"]),
    ]
    for x, fill, lines in chips:
        mini(c, x, 148, 140, 48, fill, lines)

    arrow(c, 176, 172, 194, 172, LINE, 1.8, 8)
    arrow(c, 336, 172, 354, 172, LINE, 1.8, 8)
    arrow(c, 496, 172, 514, 172, LINE, 1.8, 8)
    arrow(c, 656, 172, 674, 172, LINE, 1.8, 8)

    rounded(c, 36, 48, W - 72, 84, white, 12)
    c.setStrokeColor(HexColor("#e7e5e4"))
    c.setLineWidth(1)
    c.roundRect(36, 48, W - 72, 84, 12, fill=0, stroke=1)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(52, 112, "Then a wrong voucher")
    c.setFont("Helvetica", 9)
    c.setFillColor(MUTED)
    c.drawString(52, 94, "Delete that sale of 8 bags to Sharma Krishi Bhandar. Stock returns from 22 to 30. SP stays 270.")
    c.drawString(52, 78, "Buy was 20 bags. Sell 25 more so only 5 remain, then try to delete the purchase. The book refuses.")
    c.drawString(52, 62, "Gross margin on the dashboard is today's sales minus the cost price captured on each sale line.")
    footer(c, 3, 3)


def build(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(path), pagesize=PAGE)
    c.setTitle("ShopStore counter workflow")
    c.setAuthor("ShopStore")
    page_system(c)
    c.showPage()
    page_flow(c)
    c.showPage()
    page_rules(c)
    c.save()


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("docs/shopstore-workflow.pdf")
    build(target)
    print(target.resolve())

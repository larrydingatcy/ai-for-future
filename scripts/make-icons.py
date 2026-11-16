"""Generate PWA / Apple touch icons: a smiling yellow star on a purple sky."""
import math
from PIL import Image, ImageDraw

def star(cx, cy, R, r):
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rad = R if i % 2 == 0 else r
        pts.append((cx + rad * math.cos(a), cy + rad * math.sin(a)))
    return pts

def icon(size, pad=0.0):
    S = size * 4  # supersample
    im = Image.new('RGB', (S, S), '#5B3DF0')
    d = ImageDraw.Draw(im)
    for y in range(S):  # vertical gradient
        t = y / S
        c = (int(124 - 40 * t), int(92 - 40 * t), int(255 - 60 * t))
        d.line([(0, y), (S, y)], fill=c)
    for (x, y, s) in [(0.15, 0.18, 0.012), (0.85, 0.15, 0.009), (0.82, 0.82, 0.01), (0.12, 0.78, 0.008)]:
        d.ellipse([x * S - s * S, y * S - s * S, x * S + s * S, y * S + s * S], fill='#FFFFFF')
    k = 1 - pad
    cx, cy, R, r = S / 2, S * 0.53, S * 0.40 * k, S * 0.22 * k
    w = int(S * 0.06 * k)
    pts = star(cx, cy, R, r)
    d.polygon(pts, fill='#F29E00')
    d.line(pts + [pts[0]], fill='#F29E00', width=w * 2, joint='curve')
    pts2 = star(cx, cy, R * 0.97, r * 0.97)
    d.polygon(pts2, fill='#FFD84D')
    d.line(pts2 + [pts2[0]], fill='#FFD84D', width=int(w * 1.3), joint='curve')
    e = S * 0.045 * k
    for ex in (cx - S * 0.09 * k, cx + S * 0.09 * k):
        d.ellipse([ex - e * 0.8, cy - e * 1.1, ex + e * 0.8, cy + e * 1.1], fill='#3B2600')
        d.ellipse([ex - e * 0.1, cy - e * 0.8, ex + e * 0.5, cy - e * 0.2], fill='#FFFFFF')
    for chx in (cx - S * 0.17 * k, cx + S * 0.17 * k):
        d.ellipse([chx - e, cy + e * 0.9, chx + e, cy + e * 1.8], fill='#FF9DB9')
    m = S * 0.08 * k
    d.arc([cx - m, cy + e * 0.2, cx + m, cy + e * 0.2 + m * 1.2], 20, 160, fill='#3B2600', width=int(S * 0.018 * k))
    return im.resize((size, size), Image.LANCZOS)

icon(192).save('public/icons/icon-192.png')
icon(512).save('public/icons/icon-512.png')
icon(512, pad=0.18).save('public/icons/icon-512-maskable.png')
icon(180).save('public/icons/apple-touch-icon.png')
icon(64).save('public/favicon.png')
print('icons ok')

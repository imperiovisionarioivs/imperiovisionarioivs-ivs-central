from PIL import Image, ImageDraw, ImageFont
import os

OUT = "public/icons"
os.makedirs(OUT, exist_ok=True)

BLACK = (10, 11, 13, 255)
GOLD = (201, 158, 60, 255)
GOLD_LIGHT = (229, 200, 118, 255)

FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"


def draw_icon(size, maskable=False, path="icon.png"):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if maskable:
        # Full-bleed background, no rounding (system applies the mask)
        d.rectangle([0, 0, size, size], fill=BLACK)
        safe_margin = size * 0.16
    else:
        radius = size * 0.22
        d.rounded_rectangle([0, 0, size, size], radius=radius, fill=BLACK)
        safe_margin = size * 0.12

    # Thin gold ring
    ring_w = max(2, size * 0.012)
    inset = safe_margin * 0.55
    d.rounded_rectangle(
        [inset, inset, size - inset, size - inset],
        radius=(size * 0.18),
        outline=GOLD + (140,) if len(GOLD) == 3 else (GOLD[0], GOLD[1], GOLD[2], 140),
        width=int(ring_w),
    )

    # Monogram "IVS"
    text = "IVS"
    font_size = int(size * 0.40)
    font = ImageFont.truetype(FONT_PATH, font_size)
    bbox = d.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = (size - tw) / 2 - bbox[0]
    ty = (size - th) / 2 - bbox[1] - size * 0.02
    d.text((tx, ty), text, font=font, fill=GOLD_LIGHT)

    # Baseline hairline
    line_y = size * 0.66
    line_w = size * 0.30
    d.line(
        [(size / 2 - line_w / 2, line_y), (size / 2 + line_w / 2, line_y)],
        fill=GOLD,
        width=max(2, int(size * 0.008)),
    )

    img.save(os.path.join(OUT, path))
    print("wrote", path, size)


draw_icon(192, maskable=False, path="ivs-192.png")
draw_icon(512, maskable=False, path="ivs-512.png")
draw_icon(512, maskable=True, path="ivs-maskable-512.png")

# Also a plain favicon-ish 32/180 apple touch fallback based on same art
draw_icon(32, maskable=False, path="ivs-32.png")
draw_icon(180, maskable=False, path="ivs-180.png")

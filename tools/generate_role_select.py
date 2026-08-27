from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "ui"
OUT_DIR.mkdir(parents=True, exist_ok=True)

OUT = OUT_DIR / "role_select.png"
FONT_PATH = Path(r"C:\Windows\Fonts\ariblk.ttf")

TEXT = "ROLE SELECT"
CANVAS_W = 750
CANVAS_H = 220
TARGET_BBOX = (0, 50, 726, 171)
FILL = (82, 205, 170, 96)
MEASURE_PAD = 200


def measure(font: ImageFont.FreeTypeFont):
    scratch = Image.new("L", (2400, 800), 0)
    draw = ImageDraw.Draw(scratch)
    draw.text((MEASURE_PAD, MEASURE_PAD), TEXT, font=font, fill=255)
    return scratch.getbbox()


def main():
    target_w = TARGET_BBOX[2] - TARGET_BBOX[0]
    target_h = TARGET_BBOX[3] - TARGET_BBOX[1]

    best_size = 10
    best_diff = 10**9
    for size in range(20, 260):
        font = ImageFont.truetype(str(FONT_PATH), size)
        bbox = measure(font)
        if not bbox:
            continue
        h = bbox[3] - bbox[1]
        diff = abs(h - target_h)
        if diff < best_diff:
            best_size = size
            best_diff = diff

    font = ImageFont.truetype(str(FONT_PATH), best_size)
    bbox = measure(font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    mask = Image.new("L", (text_w, text_h), 0)
    draw = ImageDraw.Draw(mask)
    draw.text((MEASURE_PAD - bbox[0], MEASURE_PAD - bbox[1]), TEXT, font=font, fill=255)

    if text_w != target_w or text_h != target_h:
        mask = mask.resize((target_w, target_h), Image.Resampling.LANCZOS)

    colored = Image.new("RGBA", (target_w, target_h), FILL)
    alpha = mask.point(lambda v: round(v * FILL[3] / 255))
    colored.putalpha(alpha)

    out = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    out.alpha_composite(colored, (TARGET_BBOX[0], TARGET_BBOX[1]))
    out.save(OUT)
    print(f"Wrote {OUT}")
    print(f"canvas={CANVAS_W}x{CANVAS_H}")
    print(f"target_bbox={TARGET_BBOX}")
    print(f"fill={FILL}")
    print(f"font={FONT_PATH} size={best_size}")


if __name__ == "__main__":
    main()

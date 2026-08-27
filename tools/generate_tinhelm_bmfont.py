from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "fonts"
OUT_DIR.mkdir(parents=True, exist_ok=True)

FONT_PATHS = [
    Path(r"C:\Windows\Fonts\ariblk.ttf"),
    Path(r"C:\Windows\Fonts\arialbd.ttf"),
    Path(r"C:\Windows\Fonts\bahnschrift.ttf"),
]

FONT_SIZE = 96
PADDING = 16
SPACING = 6
ATLAS_WIDTH = 1024
FONT_NAME = "tinhelm_bitmap"
IMAGE_NAME = f"{FONT_NAME}.png"
FNT_NAME = f"{FONT_NAME}.fnt"
CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

# Sampled from the provided reference image.
FILL = (82, 201, 169, 255)


def pick_font() -> Path:
    for path in FONT_PATHS:
        if path.exists():
            return path
    raise FileNotFoundError("No usable system font was found.")


def glyph_bbox(font: ImageFont.FreeTypeFont, char: str):
    bbox = font.getbbox(char, anchor="ls")
    if bbox is None:
        return (0, 0, 0, 0)
    return bbox


def main():
    font_path = pick_font()
    font = ImageFont.truetype(str(font_path), FONT_SIZE)
    ascent, descent = font.getmetrics()
    line_height = ascent + descent + PADDING

    glyphs = []
    x = PADDING
    y = PADDING
    row_height = 0

    for char in CHARS:
        left, top, right, bottom = glyph_bbox(font, char)
        width = max(1, right - left)
        height = max(1, bottom - top)
        cell_w = width + PADDING * 2
        cell_h = height + PADDING * 2

        if x + cell_w + PADDING > ATLAS_WIDTH:
            x = PADDING
            y += row_height + SPACING
            row_height = 0

        glyphs.append(
            {
                "char": char,
                "id": ord(char),
                "x": x,
                "y": y,
                "w": width,
                "h": height,
                "xoffset": left,
                "yoffset": ascent + top,
                "xadvance": int(font.getlength(char)) + 4,
                "draw_x": x + PADDING - left,
                "draw_y": y + PADDING - top,
            }
        )

        x += cell_w + SPACING
        row_height = max(row_height, cell_h)

    atlas_height = y + row_height + PADDING * 2
    atlas = Image.new("RGBA", (ATLAS_WIDTH, atlas_height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(atlas)

    for glyph in glyphs:
        draw.text((glyph["draw_x"], glyph["draw_y"]), glyph["char"], font=font, fill=FILL)

    image_path = OUT_DIR / IMAGE_NAME
    fnt_path = OUT_DIR / FNT_NAME
    atlas.save(image_path)

    with fnt_path.open("w", encoding="utf-8", newline="\n") as f:
        f.write(
            f'info face="{FONT_NAME}" size={FONT_SIZE} bold=1 italic=0 charset="" unicode=1 '
            f'stretchH=100 smooth=1 aa=1 padding=0,0,0,0 spacing={SPACING},{SPACING} outline=0\n'
        )
        f.write(
            f"common lineHeight={line_height} base={ascent} scaleW={ATLAS_WIDTH} scaleH={atlas_height} "
            "pages=1 packed=0 alphaChnl=1 redChnl=4 greenChnl=4 blueChnl=4\n"
        )
        f.write(f'page id=0 file="{IMAGE_NAME}"\n')
        f.write(f"chars count={len(glyphs)}\n")
        for glyph in glyphs:
            f.write(
                "char "
                f"id={glyph['id']} x={glyph['x'] + PADDING} y={glyph['y'] + PADDING} "
                f"width={glyph['w']} height={glyph['h']} "
                f"xoffset={glyph['xoffset']} yoffset={glyph['yoffset']} "
                f"xadvance={glyph['xadvance']} page=0 chnl=15\n"
            )

    print(f"Wrote {image_path}")
    print(f"Wrote {fnt_path}")
    print(f"Font source: {font_path}")


if __name__ == "__main__":
    main()

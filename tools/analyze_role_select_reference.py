from collections import Counter
from pathlib import Path
from PIL import Image


REF = Path(r"C:\Users\DHXM\AppData\Local\Temp\codex-clipboard-80560819-fb5b-4082-9660-60b137567cbc.png")


def main():
    im = Image.open(REF).convert("RGBA")
    pixels = list(im.getdata())
    colors = Counter(pixels)
    non_black = [
        (x, y, im.getpixel((x, y)))
        for y in range(im.height)
        for x in range(im.width)
        if im.getpixel((x, y))[:3] != (0, 0, 0)
    ]
    xs = [p[0] for p in non_black]
    ys = [p[1] for p in non_black]

    print(f"size={im.width}x{im.height} mode={im.mode}")
    print(f"alpha_values={sorted({a for *_, a in pixels})[:20]}")
    print("top_colors=")
    for color, count in colors.most_common(8):
        print(f"  {color} count={count}")
    if non_black:
        print(f"text_bbox=({min(xs)}, {min(ys)}, {max(xs) + 1}, {max(ys) + 1})")
        print(f"text_color_sample={non_black[len(non_black)//2][2]}")


if __name__ == "__main__":
    main()

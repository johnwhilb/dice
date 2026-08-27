from collections import Counter
from pathlib import Path
from PIL import Image


IMG = Path("assets/ui/role_select.png")


def main():
    im = Image.open(IMG).convert("RGBA")
    pixels = list(im.getdata())
    non_transparent = [
        (x, y, im.getpixel((x, y)))
        for y in range(im.height)
        for x in range(im.width)
        if im.getpixel((x, y))[3] > 0
    ]
    xs = [p[0] for p in non_transparent]
    ys = [p[1] for p in non_transparent]
    print(f"size={im.width}x{im.height} mode={im.mode}")
    print(f"bbox=({min(xs)}, {min(ys)}, {max(xs) + 1}, {max(ys) + 1})")
    for color, count in Counter(pixels).most_common(6):
        print(f"{color} count={count}")


if __name__ == "__main__":
    main()

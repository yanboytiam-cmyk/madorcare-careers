"""Generates the QR codes that point at the MaDorCARE application form.

Four files, all pointing at the same URL:
  qr-transparent.png  navy modules, no background — drop straight onto the flyer
  qr-plate.png        navy on a white rounded plate — safe over busy artwork
  qr-logo.png         the plate with the MaDorCARE mark in the middle
  qr.svg              vector, for print at any size
"""

from pathlib import Path

import segno
from PIL import Image, ImageDraw

URL = "https://yanboytiam-cmyk.github.io/madorcare-careers/"
NAVY = "#16305C"
SIZE = 1200                     # final square, in pixels
HERE = Path(__file__).parent

# Error correction H survives a logo covering the middle and a bad phone camera.
qr = segno.make(URL, error="h")

qr.save(HERE / "qr-transparent.png", scale=40, border=2, dark=NAVY, light=None)
qr.save(HERE / "qr.svg", scale=10, border=2, dark=NAVY, light=None)
qr.save(HERE / "qr-plate-raw.png", scale=40, border=4, dark=NAVY, light="#FFFFFF")


def rounded_plate(qr_path: Path, out: Path, radius_ratio: float = 0.06) -> Image.Image:
    """Puts the QR on a white plate with rounded corners, sized to SIZE."""
    code = Image.open(qr_path).convert("RGBA").resize((SIZE, SIZE), Image.LANCZOS)

    plate = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [(0, 0), (SIZE - 1, SIZE - 1)], radius=int(SIZE * radius_ratio), fill=255
    )
    white = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 255))
    plate.paste(white, (0, 0), mask)
    plate.alpha_composite(code)
    plate.putalpha(mask)
    plate.save(out)
    return plate


plate = rounded_plate(HERE / "qr-plate-raw.png", HERE / "qr-plate.png")

# Same plate, with the brand mark punched into the centre.
logo = Image.open(HERE / "madorcare-logo.png").convert("RGBA")
box = int(SIZE * 0.20)
logo.thumbnail((box, box), Image.LANCZOS)

badge_pad = int(box * 0.14)
badge_w = logo.width + badge_pad * 2
badge_h = logo.height + badge_pad * 2
badge = Image.new("RGBA", (badge_w, badge_h), (0, 0, 0, 0))
bmask = Image.new("L", (badge_w, badge_h), 0)
ImageDraw.Draw(bmask).rounded_rectangle(
    [(0, 0), (badge_w - 1, badge_h - 1)], radius=int(badge_w * 0.18), fill=255
)
badge.paste(Image.new("RGBA", (badge_w, badge_h), (255, 255, 255, 255)), (0, 0), bmask)
badge.alpha_composite(logo, (badge_pad, badge_pad))

with_logo = plate.copy()
with_logo.alpha_composite(badge, ((SIZE - badge_w) // 2, (SIZE - badge_h) // 2))
with_logo.save(HERE / "qr-logo.png")

(HERE / "qr-plate-raw.png").unlink()

for name in ("qr-transparent.png", "qr-plate.png", "qr-logo.png", "qr.svg"):
    path = HERE / name
    print(f"{name:22} {path.stat().st_size // 1024:>5} KB")
print(f"\npointing at {URL}")

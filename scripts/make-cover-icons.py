from PIL import Image
from pathlib import Path

root = Path(__file__).resolve().parents[1]
src_path = root / "public" / "cover.png"
icons_dir = root / "public" / "icons"
icons_dir.mkdir(parents=True, exist_ok=True)

src = Image.open(src_path).convert("RGBA")


def make_icon(size: int, out_path: Path) -> None:
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    pad = int(size * 0.08)
    fitted = src.copy()
    fitted.thumbnail((size - pad * 2, size - pad * 2), Image.Resampling.LANCZOS)
    x = (size - fitted.width) // 2
    y = (size - fitted.height) // 2
    canvas.paste(fitted, (x, y), fitted)
    canvas.convert("RGB").save(out_path, "PNG", optimize=True)
    print(out_path.name, canvas.size)


make_icon(192, icons_dir / "icon-192.png")
make_icon(512, icons_dir / "icon-512.png")
make_icon(180, icons_dir / "apple-touch-icon.png")

cover = Image.new("RGBA", (1200, 630), (255, 255, 255, 255))
fitted = src.copy()
fitted.thumbnail((1000, 520), Image.Resampling.LANCZOS)
x = (1200 - fitted.width) // 2
y = (630 - fitted.height) // 2
cover.paste(fitted, (x, y), fitted)
out_cover = root / "public" / "og-cover.png"
cover.convert("RGB").save(out_cover, "PNG", optimize=True)
print(out_cover.name, cover.size)
print("done")

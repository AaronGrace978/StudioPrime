#!/usr/bin/env python3
"""Generate build/icon.png — Studio Prime mark (rounded display + lens)."""
from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

SIZE = 1024
BG = (8, 8, 14, 255)
ACCENT = (0, 212, 255, 255)
VIOLET = (167, 139, 250, 255)


def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(4))


def set_px(buf, x, y, color):
    if 0 <= x < SIZE and 0 <= y < SIZE:
        i = (y * SIZE + x) * 4
        buf[i : i + 4] = bytes(color)


def fill_circle(buf, cx, cy, r, color):
    r2 = r * r
    x0, x1 = max(0, int(cx - r) - 1), min(SIZE, int(cx + r) + 2)
    y0, y1 = max(0, int(cy - r) - 1), min(SIZE, int(cy + r) + 2)
    for y in range(y0, y1):
        dy = y + 0.5 - cy
        for x in range(x0, x1):
            dx = x + 0.5 - cx
            d2 = dx * dx + dy * dy
            if d2 <= r2:
                set_px(buf, x, y, color)


def stroke_rounded_rect(buf, x, y, w, h, radius, thickness, color):
    # Distance-field rounded rect stroke
    x0, y0, x1, y1 = x, y, x + w, y + h
    inner = thickness * 0.5
    outer = thickness * 0.5
    pad = int(thickness) + 2
    for py in range(max(0, int(y0) - pad), min(SIZE, int(y1) + pad)):
        for px in range(max(0, int(x0) - pad), min(SIZE, int(x1) + pad)):
            cx, cy = px + 0.5, py + 0.5
            # Signed distance to rounded rect
            dx = abs(cx - (x0 + x1) / 2) - (w / 2 - radius)
            dy = abs(cy - (y0 + y1) / 2) - (h / 2 - radius)
            ox, oy = max(dx, 0.0), max(dy, 0.0)
            dist = math.hypot(ox, oy) + min(max(dx, dy), 0.0) - radius
            ad = abs(dist)
            if ad <= outer + 1:
                alpha = max(0.0, min(1.0, (outer + 0.5 - ad)))
                if alpha > 0:
                    i = (py * SIZE + px) * 4
                    src = buf[i : i + 4]
                    out = mix(tuple(src), color, alpha)
                    buf[i : i + 4] = bytes(out)


def write_png(path: Path, buf: bytearray, size: int):
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    raw = bytearray()
    row = size * 4
    for y in range(size):
        raw.append(0)
        raw.extend(buf[y * row : (y + 1) * row])
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def main():
    out = Path(__file__).resolve().parents[1] / "build" / "icon.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    buf = bytearray(BG * (SIZE * SIZE))

    # Soft vignette
    cx = cy = SIZE / 2
    for y in range(SIZE):
        dy = (y + 0.5 - cy) / SIZE
        for x in range(SIZE):
            dx = (x + 0.5 - cx) / SIZE
            t = min(1.0, (dx * dx + dy * dy) * 1.6)
            color = mix(BG, (14, 14, 28, 255), t * 0.55)
            set_px(buf, x, y, color)

    margin = 118
    stroke_rounded_rect(buf, margin, margin + 36, SIZE - 2 * margin, SIZE - 2 * margin - 72, 140, 42, ACCENT)
    fill_circle(buf, cx, cy, 188, mix(ACCENT, VIOLET, 0.18))
    fill_circle(buf, cx, cy, 132, ACCENT)
    fill_circle(buf, cx - 36, cy - 40, 38, (255, 255, 255, 210))

    write_png(out, buf, SIZE)
    print(f"wrote {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()

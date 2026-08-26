"""裁剪收款码截图中的核心二维码区域。
策略：二维码每行/每列都有较高密度的暗色像素，而页面标题、昵称等文字行暗色占比很低。
先按行、列暗色密度筛出二维码所在行列，再取包围盒 + 留白 + 正方形化。
"""
from PIL import Image

JOBS = [
    ("Weixin_Shoukuan.png", "public/donate-weixin.png"),
    ("Zhifubao_Shoukuan.jpg", "public/donate-alipay.png"),
]

for src, dst in JOBS:
    img = Image.open(src).convert("RGB")
    w, h = img.size
    rpx = img.load()
    px = img.convert("L").load()
    dark = lambda x, y: px[x, y] < 90

    row_cnt = [sum(1 for x in range(0, w, 2) if dark(x, y)) for y in range(h)]
    col_cnt = [sum(1 for y in range(0, h, 2) if dark(x, y)) for x in range(w)]

    row_ok = [row_cnt[y] >= 0.08 * (w / 2) for y in range(h)]
    col_ok = [col_cnt[x] >= 0.08 * (h / 2) for x in range(w)]

    def longest_run(flags, max_gap=80):
        """取最长的连续 True 带；码内嵌头像等亮区产生的短间隙（≤max_gap）视为同一带"""
        runs = []  # (start, end)
        start = None
        gap = 0
        for i, f in enumerate(flags):
            if f:
                if start is None:
                    start = i
                gap = 0
            elif start is not None:
                gap += 1
                if gap > max_gap:
                    runs.append((start, i - gap))
                    start = None
                    gap = 0
        if start is not None:
            runs.append((start, len(flags) - 1))
        s, e = max(runs, key=lambda r: r[1] - r[0])
        return s, e

    miny, maxy = longest_run(row_ok)
    minx, maxx = longest_run(col_ok)

    # 剔除裁切区边缘的纯色背景条（支付宝蓝/微信绿），避免成品带背景边：直接刷白
    def is_flat_color_col(x):
        n = 0
        blue = green = 0
        for y in range(miny, maxy + 1, 4):
            r, g, b = rpx[x, y]
            n += 1
            if b - r > 80 and b > 150:
                blue += 1
            elif g - r > 60 and g > 150:
                green += 1
        return n > 0 and (blue + green) / n > 0.85

    while minx < maxx and is_flat_color_col(minx):
        minx += 1
    while maxx > minx and is_flat_color_col(maxx):
        maxx -= 1

    print(f"{src}: qr bbox=({minx},{miny})-({maxx},{maxy})")

    pad = 30
    side = max(maxx - minx, maxy - miny) + 2 * pad
    cx, cy = (minx + maxx) // 2, (miny + maxy) // 2
    x0, y0 = cx - side // 2, cy - side // 2
    x1, y1 = x0 + side, y0 + side
    if x0 < 0: x1 -= x0; x0 = 0
    if y0 < 0: y1 -= y0; y0 = 0
    if x1 > w: x0 -= (x1 - w); x1 = w
    if y1 > h: y0 -= (y1 - h); y1 = h
    crop = img.crop((max(0, x0), max(0, y0), x1, y1))
    cpx = crop.load()
    cw, ch = crop.size
    for x in range(cw):
        n = 0
        colored = 0
        for y in range(0, ch, 4):
            r, g, b = cpx[x, y]
            n += 1
            if (b - r > 80 and b > 150) or (g - r > 60 and g > 150):
                colored += 1
        if n > 0 and colored / n > 0.85:
            for y in range(ch):
                cpx[x, y] = (255, 255, 255)
    crop = crop.resize((560, 560), Image.LANCZOS)
    crop.save(dst)
    print(f"  -> {dst} 560x560")

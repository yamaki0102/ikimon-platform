#!/usr/bin/env python3
"""
generate_icons.py — サイト汎用 PWA アイコン一括生成ツール

どのプロジェクトでも使える。マスター画像1枚から全サイズのアイコンを一括生成。

Requirements:
    pip install Pillow

Usage:
    python generate_icons.py <master_image> [--outdir <dir>] [--bg <hex>] [--defringe]

Examples:
    # ikimon.life
    python tools/generate_icons.py public_html/assets/img/icon-512.png \\
        --outdir public_html/assets/img --bg "#020405" --defringe

    # 別プロジェクト
    python generate_icons.py logo-master.png --outdir dist/icons --bg "#1a1a2e"

    # 白背景サイト（背景色を白に）
    python generate_icons.py logo.png --outdir public/img --bg "#ffffff"
"""
import argparse
import os
import sys
import numpy as np
from PIL import Image


def hex_to_rgba(hex_color: str) -> tuple:
    """#RRGGBB → (R, G, B, 255)"""
    h = hex_color.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) + (255,)


def defringe_image(img: Image.Image) -> Image.Image:
    """白背景アンチエイリアスのフリンジを除去する。

    元画像が白背景上でレンダリングされた後に透過化された場合、
    半透明エッジに白い色が残る。この関数はコンポジット逆算で
    本来のピクセル色を復元する。
    """
    data = np.array(img, dtype=np.float64)
    r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]
    alpha_norm = a / 255.0

    semi = (a > 0) & (a < 255)

    for ch in [r, g, b]:
        mask = semi & (alpha_norm > 0.01)
        original = ch[mask]
        al = alpha_norm[mask]
        # 白背景コンポジットの逆算: color = (pixel - 255*(1-alpha)) / alpha
        recovered = (original - 255.0 * (1.0 - al)) / al
        ch[mask] = np.clip(recovered, 0, 255)

    # 極低アルファ（ほぼ白フリンジ）を暗くする
    very_low = (a > 0) & (a <= 10)
    for ch in [r, g, b]:
        ch[very_low] = np.clip(ch[very_low] * 0.3, 0, 255)

    data[:,:,0], data[:,:,1], data[:,:,2] = r, g, b
    return Image.fromarray(data.astype(np.uint8), 'RGBA')


def generate(master_path: str, outdir: str, bg_color: tuple, do_defringe: bool):
    if not os.path.exists(master_path):
        print(f"Error: マスター画像が見つかりません: {master_path}")
        sys.exit(1)

    os.makedirs(outdir, exist_ok=True)

    print(f"マスター: {master_path}")
    print(f"出力先:   {outdir}")
    print(f"背景色:   #{bg_color[0]:02x}{bg_color[1]:02x}{bg_color[2]:02x}")

    src = Image.open(master_path).convert('RGBA')

    if do_defringe:
        print("デフリンジ処理中...")
        src = defringe_image(src)
        # マスターも上書き保存
        src.save(master_path)
        print(f"  → マスター画像を更新: {master_path}")

    generated = []

    # --- 1. Standard (any purpose) ---
    for size in [192, 512]:
        out = os.path.join(outdir, f'icon-{size}.png')
        src.resize((size, size), Image.LANCZOS).save(out)
        generated.append(out)

    # --- 2. Maskable (80% safe zone + background) ---
    for size in [192, 512]:
        out = os.path.join(outdir, f'icon-{size}-maskable.png')
        canvas = Image.new('RGBA', (size, size), bg_color)
        logo_w = int(size * 0.8)
        logo = src.resize((logo_w, logo_w), Image.LANCZOS)
        offset = (size - logo_w) // 2
        canvas.paste(logo, (offset, offset), logo)
        canvas.save(out)
        generated.append(out)

    # --- 3. Apple Touch Icon (180x180) ---
    out = os.path.join(outdir, 'apple-touch-icon.png')
    src.resize((180, 180), Image.LANCZOS).save(out)
    generated.append(out)

    # --- 4. Favicon (32x32) ---
    out = os.path.join(outdir, 'favicon-32.png')
    src.resize((32, 32), Image.LANCZOS).save(out)
    generated.append(out)

    # --- 5. OGP Default (1200x630, 横長推奨) ---
    out = os.path.join(outdir, 'ogp_default.png')
    ogp = Image.new('RGBA', (1200, 630), bg_color)
    logo_h = int(630 * 0.6)   # 高さの60%
    logo = src.resize((logo_h, logo_h), Image.LANCZOS)
    ox = (1200 - logo_h) // 2
    oy = (630 - logo_h) // 2
    ogp.paste(logo, (ox, oy), logo)
    ogp.save(out)
    generated.append(out)

    print(f"\n生成完了: {len(generated)}ファイル")
    for f in generated:
        print(f"  ✅ {f}")

    print("\n💡 manifest.json の icons セクションに以下を設定してね:")
    print("""
  "icons": [
    { "src": "icon-192.png",          "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icon-512.png",          "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icon-192-maskable.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]""")


def main():
    parser = argparse.ArgumentParser(
        description='サイト汎用 PWA アイコン一括生成ツール',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument('master', help='マスター画像パス (推奨: 512x512以上の正方形PNG)')
    parser.add_argument('--outdir', '-o', default='.', help='出力ディレクトリ (デフォルト: カレント)')
    parser.add_argument('--bg', default='#020405', help='背景色 hex (デフォルト: #020405)')
    parser.add_argument('--defringe', action='store_true',
                        help='白背景フリンジ除去を実行 (白背景からの透過変換画像向け)')

    args = parser.parse_args()
    bg = hex_to_rgba(args.bg)
    generate(args.master, args.outdir, bg, args.defringe)


if __name__ == '__main__':
    main()

<?php

/**
 * ThumbnailGenerator — 投稿画像のサムネイル事前生成
 *
 * サイズプリセット:
 *   sm = 320px (フィードグリッド・カード用)
 *   md = 640px (詳細ページ・モバイル用)
 *
 * 命名規則:
 *   photo_0.webp → photo_0_sm.webp, photo_0_md.webp
 *   すべて WebP 出力（最小ファイルサイズ）
 */
class ThumbnailGenerator
{
    /** @var array<string, int> サイズプリセット (suffix => max dimension) */
    const PRESETS = [
        'sm' => 320,
        'md' => 640,
    ];

    const WEBP_QUALITY = 80;

    /**
     * 観察の全写真に対してサムネイルを生成
     *
     * @param array $observation 観察レコード（photos配列を持つ）
     * @return array 生成されたサムネイルパスの配列
     */
    public static function generateForObservation(array $observation): array
    {
        if (empty($observation['photos'])) {
            return [];
        }

        $generated = [];
        foreach ($observation['photos'] as $photoPath) {
            $absPath = app_public_path($photoPath);
            if (!file_exists($absPath)) {
                continue;
            }

            foreach (self::PRESETS as $suffix => $maxDim) {
                $thumbPath = self::thumbnailPath($photoPath, $suffix);
                $absThumbPath = app_public_path($thumbPath);

                // 既に存在すればスキップ
                if (file_exists($absThumbPath)) {
                    $generated[] = $thumbPath;
                    continue;
                }

                if (self::resize($absPath, $absThumbPath, $maxDim)) {
                    $generated[] = $thumbPath;
                }
            }
        }

        return $generated;
    }

    /**
     * 1枚の画像をリサイズして WebP サムネイルとして保存
     *
     * @param string $srcPath 元画像の絶対パス
     * @param string $dstPath 出力先の絶対パス
     * @param int $maxDim 長辺の最大ピクセル数
     * @return bool 成功したか
     */
    public static function resize(string $srcPath, string $dstPath, int $maxDim): bool
    {
        if (!extension_loaded('gd')) {
            return false;
        }

        $info = @getimagesize($srcPath);
        if (!$info) {
            return false;
        }

        [$origW, $origH] = $info;
        $mime = $info['mime'];

        // 元画像が既にサムネイルサイズ以下ならコピーだけ
        if ($origW <= $maxDim && $origH <= $maxDim) {
            // WebP変換だけ行う
            $src = self::createFromFile($srcPath, $mime);
            if (!$src) return false;
            $result = imagewebp($src, $dstPath, self::WEBP_QUALITY);
            imagedestroy($src);
            return $result;
        }

        // アスペクト比を保持してリサイズ
        if ($origW >= $origH) {
            $newW = $maxDim;
            $newH = (int) round($origH * ($maxDim / $origW));
        } else {
            $newH = $maxDim;
            $newW = (int) round($origW * ($maxDim / $origH));
        }

        $src = self::createFromFile($srcPath, $mime);
        if (!$src) return false;

        $dst = imagecreatetruecolor($newW, $newH);
        if (!$dst) {
            imagedestroy($src);
            return false;
        }

        // WebP は透過をサポート
        imagealphablending($dst, false);
        imagesavealpha($dst, true);

        imagecopyresampled($dst, $src, 0, 0, 0, 0, $newW, $newH, $origW, $origH);

        $result = imagewebp($dst, $dstPath, self::WEBP_QUALITY);

        imagedestroy($src);
        imagedestroy($dst);

        return $result;
    }

    /**
     * MIME タイプに応じて GD リソースを生成
     */
    private static function createFromFile(string $path, string $mime)
    {
        switch ($mime) {
            case 'image/jpeg': return @imagecreatefromjpeg($path);
            case 'image/png':
                $img = @imagecreatefrompng($path);
                if ($img) {
                    imagealphablending($img, true);
                    imagesavealpha($img, true);
                }
                return $img;
            case 'image/webp': return @imagecreatefromwebp($path);
            case 'image/gif': return @imagecreatefromgif($path);
            default: return false;
        }
    }

    /**
     * 写真パスからサムネイルパスを生成
     *
     * @param string $photoPath 例: "uploads/photos/{id}/photo_0.webp"
     * @param string $suffix    例: "sm" or "md"
     * @return string           例: "uploads/photos/{id}/photo_0_sm.webp"
     */
    public static function thumbnailPath(string $photoPath, string $suffix): string
    {
        $dir = dirname($photoPath);
        $basename = pathinfo($photoPath, PATHINFO_FILENAME);
        // 常に .webp 出力
        return $dir . '/' . $basename . '_' . $suffix . '.webp';
    }

    /**
     * サムネイルが存在すればそのパスを、なければ元画像パスを返す
     * フロントエンド表示用ヘルパー
     *
     * @param string $photoPath 元画像の相対パス
     * @param string $suffix    "sm" or "md"
     * @return string 使用すべき画像パス
     */
    public static function resolve(string $photoPath, string $suffix = 'sm'): string
    {
        $thumbPath = self::thumbnailPath($photoPath, $suffix);
        $absThumbPath = app_public_path($thumbPath);

        if (file_exists($absThumbPath)) {
            return $thumbPath;
        }

        return $photoPath;
    }

    /**
     * 元画像または生成済みサムネイルが存在するかを返す
     */
    public static function exists(string $photoPath, string $suffix = 'sm'): bool
    {
        $absPath = app_public_path($photoPath);
        if (file_exists($absPath)) {
            return true;
        }

        $thumbPath = self::thumbnailPath($photoPath, $suffix);
        $absThumbPath = app_public_path($thumbPath);
        return file_exists($absThumbPath);
    }

    /**
     * 観察の最初の写真のサムネイルURLを返す（フィード/グリッド用）
     *
     * @param array $observation 観察レコード
     * @param string $suffix "sm" or "md"
     * @return string|null 画像パスまたはnull
     */
    public static function feedImage(array $observation, string $suffix = 'sm'): ?string
    {
        if (empty($observation['photos'][0])) {
            return null;
        }
        if (!self::exists($observation['photos'][0], $suffix)) {
            return null;
        }
        return self::resolve($observation['photos'][0], $suffix);
    }
}

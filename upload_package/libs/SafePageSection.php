<?php

final class SafePageSection
{
    public static function render(string $sectionKey, callable $renderer, ?callable $fallback = null): void
    {
        $bufferLevel = ob_get_level();
        ob_start();

        try {
            $renderer();
            $content = (string)ob_get_clean();
            echo $content;
        } catch (Throwable $e) {
            while (ob_get_level() > $bufferLevel) {
                ob_end_clean();
            }

            $requestUri = $_SERVER['REQUEST_URI'] ?? '';
            error_log(sprintf(
                '[safe-page-section] %s failed on %s: %s in %s:%d',
                $sectionKey,
                $requestUri,
                $e->getMessage(),
                $e->getFile(),
                $e->getLine()
            ));

            echo '<!-- safe-page-section fallback: ' . htmlspecialchars($sectionKey, ENT_QUOTES, 'UTF-8') . ' -->';
            if ($fallback !== null) {
                $fallback($e);
            }
        }
    }
}

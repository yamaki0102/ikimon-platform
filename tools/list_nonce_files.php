<?php
// List all PHP files under public_html that contain CspNonce::attr()
$base = realpath(__DIR__ . '/../upload_package/public_html');
$iter = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($base, FilesystemIterator::SKIP_DOTS)
);
$files = [];
foreach ($iter as $f) {
    if ($f->getExtension() !== 'php') continue;
    $content = file_get_contents($f->getPathname());
    if (strpos($content, 'CspNonce::attr()') !== false) {
        $rel = str_replace('\\', '/', substr($f->getPathname(), strlen($base)));
        $files[] = $rel;
    }
}
echo count($files) . " files with CspNonce::attr()\n";
foreach ($files as $f) {
    echo $f . "\n";
}

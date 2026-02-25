# Deploy script for ikimon.life
$ErrorActionPreference = "Stop"

$key = "$env:USERPROFILE\.ssh\production.pem"
$dest = "r1522484@www1070.onamae.ne.jp"
$port = "8022"
$root = "~/public_html/ikimon.life"
$src = "upload_package"
$webroot = "~/public_html/ikimon.life/public_html"
$srcPub = "upload_package/public_html"
$dateStr = Get-Date -Format "yyyyMMdd_HHmmss"

Write-Host "--- Step 1: Backup ---"
ssh -p $port -i $key $dest "cd ~/public_html && tar czf ~/ikimon_backup_${dateStr}.tar.gz ikimon.life/"
Write-Host "Backup completed."

Write-Host "--- Step 2: Upload backend ---"
scp -P $port -i $key -r "$src/config" "${dest}:${root}/"
scp -P $port -i $key -r "$src/libs" "${dest}:${root}/"
scp -P $port -i $key -r "$src/lang" "${dest}:${root}/"
scp -P $port -i $key -r "$src/scripts" "${dest}:${root}/"
Write-Host "Backend upload completed."

Write-Host "--- Step 3: Upload frontend ---"
Get-ChildItem -Path $srcPub -File | ForEach-Object {
    scp -P $port -i $key $_.FullName "${dest}:${webroot}/"
}
scp -P $port -i $key -r "$srcPub/api" "${dest}:${webroot}/"
scp -P $port -i $key -r "$srcPub/components" "${dest}:${webroot}/"
scp -P $port -i $key -r "$srcPub/assets" "${dest}:${webroot}/"
Write-Host "Frontend upload completed."

Write-Host "--- Step 4: Fix permissions ---"
ssh -p $port -i $key $dest "find ${root} -type d -exec chmod 755 {} \;; find ${root} -name '.htaccess' -exec chmod 644 {} \;; find ${root} -type f -name '*.php' -exec chmod 644 {} \;; echo 'PERMISSIONS_FIXED'"
Write-Host "Permissions fixed."

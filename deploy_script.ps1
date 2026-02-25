$key = "$env:USERPROFILE\.ssh\production.pem"
$dest = "r1522484@www1070.onamae.ne.jp"
$port = "8022"
$root = "~/public_html/ikimon.life"
$webroot = "~/public_html/ikimon.life/public_html"
$src = "G:\その他のパソコン\マイ ノートパソコン\antigravity\ikimon\ikimon.life\upload_package"
$srcPub = "$src\public_html"

Write-Host "Step 1: Backup"
ssh -p $port -i $key $dest "cd ~/public_html && tar czf ~/ikimon_backup_`$(date +%Y%m%d).tar.gz ikimon.life/"

Write-Host "Step 2: Backend files"
scp -P $port -i $key -r "$src/config" "${dest}:${root}/"
scp -P $port -i $key -r "$src/libs" "${dest}:${root}/"
scp -P $port -i $key -r "$src/lang" "${dest}:${root}/"
scp -P $port -i $key -r "$src/scripts" "${dest}:${root}/"

Write-Host "Step 3: Webroot files"
Get-ChildItem -Path $srcPub -File | ForEach-Object {
    scp -P $port -i $key $_.FullName "${dest}:${webroot}/"
}

scp -P $port -i $key -r "$srcPub/api" "${dest}:${webroot}/"
scp -P $port -i $key -r "$srcPub/components" "${dest}:${webroot}/"
scp -P $port -i $key -r "$srcPub/assets" "${dest}:${webroot}/"
scp -P $port -i $key -r "$srcPub/admin" "${dest}:${webroot}/"
scp -P $port -i $key -r "$srcPub/demo" "${dest}:${webroot}/"
scp -P $port -i $key -r "$srcPub/for-business" "${dest}:${webroot}/"
scp -P $port -i $key -r "$srcPub/js" "${dest}:${webroot}/"
scp -P $port -i $key -r "$srcPub/views" "${dest}:${webroot}/"

Write-Host "Step 3.5: Permissions"
ssh -p $port -i $key $dest "find ${root} -type d -exec chmod 755 {} \; && find ${root} -name '.htaccess' -exec chmod 644 {} \; && find ${root} -type f -name '*.php' -exec chmod 644 {} \; && echo 'PERMISSIONS_FIXED'"

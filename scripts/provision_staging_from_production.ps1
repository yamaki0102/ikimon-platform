param(
    [string]$HostAlias = "ikimon-vps",
    [string]$ProductionRoot = "/var/www/ikimon.life",
    [string]$StagingRoot = "/var/www/ikimon.life-staging",
    [string]$ReferenceDeploy = "ops/deploy/staging_deploy_reference.sh",
    [string]$ReferenceNginx = "ops/deploy/staging_nginx_local_reference.conf",
    [string]$ReferenceTlsNginx = "ops/deploy/staging_nginx_tls_reference.conf",
    [string]$Branch = "main",
    [string]$PublicStagingHost = "staging.162-43-44-131.sslip.io"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$deployRefPath = Join-Path $repoRoot $ReferenceDeploy
$nginxRefPath = Join-Path $repoRoot $ReferenceNginx
$nginxTlsRefPath = Join-Path $repoRoot $ReferenceTlsNginx
if (-not (Test-Path $deployRefPath)) {
    throw "Missing reference deploy script: $deployRefPath"
}

if (-not (Test-Path $nginxRefPath)) {
    throw "Missing reference nginx config: $nginxRefPath"
}

if (-not (Test-Path $nginxTlsRefPath)) {
    throw "Missing reference TLS nginx config: $nginxTlsRefPath"
}

$accessNoteDir = Join-Path $repoRoot "_archive\staging_access"
New-Item -ItemType Directory -Path $accessNoteDir -Force | Out-Null

function Invoke-Remote([string]$Command) {
    $result = & ssh $HostAlias $Command
    if ($LASTEXITCODE -ne 0) {
        throw "Remote command failed: $Command"
    }
    return @($result | ForEach-Object { [string]$_ })
}

function Invoke-RemoteFirst([string]$Command) {
    $lines = Invoke-Remote $Command
    if ($lines.Count -eq 0) {
        return ""
    }
    return ([string]$lines[0]).Trim()
}

Invoke-Remote @"
set -euo pipefail
PROD_ROOT='$ProductionRoot'
STAGE_ROOT='$StagingRoot'
REPO_URL=`$(cd "`$PROD_ROOT/repo" && git config --get remote.origin.url)

mkdir -p "`$STAGE_ROOT"
if [ ! -d "`$STAGE_ROOT/repo/.git" ]; then
  rm -rf "`$STAGE_ROOT/repo"
  git clone "`$REPO_URL" "`$STAGE_ROOT/repo"
fi

mkdir -p "`$STAGE_ROOT/backups" "`$STAGE_ROOT/manual-backups" "`$STAGE_ROOT/persistent/uploads"
mkdir -p "`$STAGE_ROOT/repo/upload_package/config" "`$STAGE_ROOT/repo/upload_package/data"
mkdir -p "`$STAGE_ROOT/acme-challenge/.well-known/acme-challenge"

rsync -a --delete "`$PROD_ROOT/repo/upload_package/data/" "`$STAGE_ROOT/repo/upload_package/data/"
rsync -a --delete "`$PROD_ROOT/persistent/uploads/" "`$STAGE_ROOT/persistent/uploads/"

for file_name in config.php oauth_config.php secret.php; do
  cp -a "`$PROD_ROOT/repo/upload_package/config/`$file_name" "`$STAGE_ROOT/repo/upload_package/config/`$file_name"
done

rm -rf "`$STAGE_ROOT/repo/upload_package/public_html/uploads"
ln -sfn "`$STAGE_ROOT/persistent/uploads" "`$STAGE_ROOT/repo/upload_package/public_html/uploads"

chown -R www-data:www-data "`$STAGE_ROOT/repo/upload_package"
chown -R www-data:www-data "`$STAGE_ROOT/persistent"

if [ ! -f /etc/nginx/.htpasswd-ikimon-staging ]; then
  STAGING_PASS=`$(openssl rand -base64 18 | tr -d '\n' | tr '/+' 'AB' | cut -c1-20)
  printf 'staging:%s\n' "`$(openssl passwd -apr1 "`$STAGING_PASS")" > /etc/nginx/.htpasswd-ikimon-staging
  chmod 644 /etc/nginx/.htpasswd-ikimon-staging
else
  STAGING_PASS=`$(sed -n 's/^password=//p' "`$STAGE_ROOT/staging_access.txt" 2>/dev/null | head -n1 || true)
  if [ -z "`$STAGING_PASS" ]; then
    STAGING_PASS='(existing on server only)'
  fi
fi
printf 'username=staging\npassword=%s\nurl=https://$PublicStagingHost/\n' "`$STAGING_PASS" > "`$STAGE_ROOT/staging_access.txt"
"@

& cmd /c "scp `"$deployRefPath`" ${HostAlias}:/tmp/ikimon-staging-deploy.sh"
if ($LASTEXITCODE -ne 0) {
    throw "Failed to upload staging deploy reference"
}

& cmd /c "scp `"$nginxRefPath`" ${HostAlias}:/tmp/ikimon-staging-nginx.conf"
if ($LASTEXITCODE -ne 0) {
    throw "Failed to upload staging nginx reference"
}

& cmd /c "scp `"$nginxTlsRefPath`" ${HostAlias}:/tmp/ikimon-staging-nginx-tls.conf"
if ($LASTEXITCODE -ne 0) {
    throw "Failed to upload staging TLS nginx reference"
}

Invoke-Remote @"
set -euo pipefail
STAGE_ROOT='$StagingRoot'
PUBLIC_HOST='$PublicStagingHost'
HTTP_URL="http://$PublicStagingHost/"
HTTPS_URL="https://$PublicStagingHost/"
TLS_CERT="/etc/letsencrypt/live/$PublicStagingHost/fullchain.pem"
install -m 755 /tmp/ikimon-staging-deploy.sh "`$STAGE_ROOT/deploy.sh"
install -m 644 /tmp/ikimon-staging-nginx.conf /etc/nginx/sites-available/ikimon.life-staging-local
ln -sfn /etc/nginx/sites-available/ikimon.life-staging-local /etc/nginx/sites-enabled/ikimon.life-staging-local
nginx -t
systemctl reload nginx

if [ ! -f "`$TLS_CERT" ] && command -v certbot >/dev/null 2>&1; then
  certbot certonly --webroot \
    -w "`$STAGE_ROOT/acme-challenge" \
    -d "`$PUBLIC_HOST" \
    --non-interactive \
    --agree-tos \
    --keep-until-expiring \
    --register-unsafely-without-email || true
fi

if [ -f "`$TLS_CERT" ]; then
  install -m 644 /tmp/ikimon-staging-nginx-tls.conf /etc/nginx/sites-available/ikimon.life-staging-local
  FINAL_URL="`$HTTPS_URL"
else
  FINAL_URL="`$HTTP_URL"
fi

PASS=`$(sed -n 's/^password=//p' "`$STAGE_ROOT/staging_access.txt" 2>/dev/null | head -n1 || true)
if [ -z "`$PASS" ]; then
  PASS='(existing on server only)'
fi
printf 'username=staging\npassword=%s\nurl=%s\n' "`$PASS" "`$FINAL_URL" > "`$STAGE_ROOT/staging_access.txt"

nginx -t
systemctl reload nginx
rm -f /tmp/ikimon-staging-deploy.sh /tmp/ikimon-staging-nginx.conf /tmp/ikimon-staging-nginx-tls.conf
STAGING_BRANCH='$Branch' "`$STAGE_ROOT/deploy.sh"
"@

Invoke-Remote "cat $StagingRoot/staging_access.txt" | Set-Content -Path (Join-Path $accessNoteDir "staging_access_latest.txt") -Encoding UTF8

Write-Output "Staging provisioned and healthy for $PublicStagingHost on $HostAlias"

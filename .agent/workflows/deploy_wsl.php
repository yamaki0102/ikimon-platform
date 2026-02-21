<?php

/**
 * deploy_wsl.php
 * Ultra-fast WSL Rsync Deployment Script for Xserver / Onamae
 * 
 * Requirements:
 * - WSL (Ubuntu or similar)
 * - PHP CLI
 * - rsync
 * - deploy.json in current directory
 */

$options = getopt("p::", ["patch::"]);
$patchMode = isset($options['p']) ? $options['p'] : (isset($options['patch']) ? $options['patch'] : null);

$configFile = getcwd() . '/deploy.json';
if (!file_exists($configFile)) {
    echo "\033[31mERROR: deploy.json not found in " . getcwd() . "\033[0m\n";
    echo "Please create deploy.json following the standard schema.\n";
    exit(1);
}

$config = json_decode(file_get_contents($configFile), true);
$required = ['TargetName', 'LocalDir', 'SshAlias', 'RemoteBase'];
foreach ($required as $req) {
    if (empty($config[$req])) {
        echo "\033[31mERROR: Missing required field '$req' in deploy.json\033[0m\n";
        exit(1);
    }
}

$localDir = rtrim($config['LocalDir'], '/');
$remoteTarget = rtrim($config['RemoteBase'], '/') . '/' . $config['TargetName'];
$sshAlias = $config['SshAlias'];

echo "\033[36m=== WSL Rsync Deploy: {$config['TargetName']} ===\033[0m\n";

if ($patchMode) {
    echo "\033[33m--- PATCH MODE: $patchMode ---\033[0m\n";
    if (!file_exists($patchMode)) {
        echo "\033[31mERROR: File not found: $patchMode\033[0m\n";
        exit(1);
    }

    $relPath = $patchMode;
    if (strpos($patchMode, $localDir . '/') === 0) {
        $relPath = substr($patchMode, strlen($localDir) + 1);
    }

    $remoteFile = "$remoteTarget/$relPath";
    echo "  Local : $patchMode\n";
    echo "  Remote: $sshAlias:$remoteFile\n";

    // Ensure remote directory for patch exists
    $remoteDir = dirname($remoteFile);
    exec("ssh $sshAlias \"mkdir -p $remoteDir\"");

    $cmd = sprintf("scp %s %s:%s", escapeshellarg($patchMode), escapeshellarg($sshAlias), escapeshellarg($remoteFile));
    passthru($cmd, $returnVar);

    if ($returnVar === 0) {
        echo "\033[32mPATCH OK\033[0m\n";
    } else {
        echo "\033[31mPATCH FAILED (code: $returnVar)\033[0m\n";
        exit(1);
    }
} else {
    echo "Local : ./$localDir/\n";
    echo "Remote: $sshAlias:$remoteTarget/\n\n";

    echo "\033[37m[1/2] Ensuring remote directories...\033[0m\n";
    exec("ssh $sshAlias \"mkdir -p $remoteTarget\"");

    echo "\033[37m[2/2] Running rsync transfer...\033[0m\n";
    // Rsync with safety excludes to protect SQLite databases from being uploaded
    // -a: archive mode, -v: verbose, -z: compress, -c: check via checksum
    $cmd = sprintf(
        "rsync -avzc --exclude='*.sqlite' --exclude='*.db' --exclude='.git' --exclude='tests' --exclude='tools' --exclude='scripts' --exclude='.jj' --exclude='docs' %s/ %s:%s/",
        escapeshellarg($localDir),
        escapeshellarg($sshAlias),
        escapeshellarg($remoteTarget)
    );

    passthru($cmd, $returnVar);

    if ($returnVar === 0) {
        echo "\n\033[32m=== Full Deploy Complete ===\033[0m\n";
    } else {
        echo "\n\033[31mERROR: Rsync failed (code: $returnVar)\033[0m\n";
        exit(1);
    }
}

if (!empty($config['Url'])) {
    echo "\033[36mVerify: {$config['Url']}\033[0m\n\n";
}

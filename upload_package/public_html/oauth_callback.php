<?php

/**
 * OAuth Callback Handler
 * 
 * Google/X(Twitter) からのリダイレクトを受け取り、
 * ユーザーの検索/作成/ログインを処理する。
 * 
 * フロー:
 * 1. OAuthプロバイダーからcode + stateを受信
 * 2. OAuthClient::handleCallback() でアクセストークン取得→プロフィール取得
 * 3. UserStore::findByOAuth() で既存ユーザーを検索
 *    - 見つかった → ログイン
 *    - 見つからない → メールで検索 → 見つかったらOAuth紐付け → ログイン
 *    - どちらもなし → 新規作成 → ログイン
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/UserStore.php';
require_once __DIR__ . '/../libs/OAuthClient.php';

Auth::init();

$provider = $_GET['provider'] ?? '';

if (!in_array($provider, ['google', 'twitter'], true)) {
    header('Location: login.php?error=invalid_provider');
    exit;
}

try {
    // Step 1: Exchange authorization code for user profile
    $profile = OAuthClient::handleCallback($provider, $_GET);

    if (empty($profile['id'])) {
        throw new \RuntimeException('OAuthプロファイルからIDを取得できませんでした');
    }

    // Step 2: Find or create user
    $user = UserStore::findByOAuth($provider, $profile['id']);

    if (!$user) {
        // Check if email already exists (account merging)
        if (!empty($profile['email'])) {
            $existingUser = UserStore::findByEmail($profile['email'])
                ?? UserStore::findBySecondaryEmail($profile['email']);
            if ($existingUser) {
                // Link OAuth to existing email account
                $user = UserStore::linkOAuth(
                    $existingUser['id'],
                    $provider,
                    $profile['id'],
                    $profile['avatar_url'] ?? '',
                    $profile['email']
                );
            }
        }

        // Still no user → create new
        if (!$user) {
            $user = UserStore::createFromOAuth($profile);
        }
    }

    // Step 3: Check if banned
    if (!empty($user['banned'])) {
        header('Location: login.php?error=banned');
        exit;
    }

    // Step 4: Migrate guest data (if any)
    $guestData = Auth::migrateGuestData();
    
    // Step 5: Login
    $loginUser = $user;
    unset($loginUser['password_hash']);
    $loginUser['rank'] = $loginUser['rank'] ?? Auth::getRankLabel($loginUser);
    Auth::login($loginUser);
    UserStore::update($user['id'], ['last_login_at' => date('Y-m-d H:i:s')]);

    // Step 6: Transfer guest observations to authenticated user
    $redirect = 'index.php';
    if (!empty($guestData['guest_id']) && !empty($guestData['post_ids'])) {
        require_once __DIR__ . '/../libs/DataStore.php';
        $migratedCount = 0;
        
        // Update each guest observation to belong to the authenticated user
        foreach ($guestData['post_ids'] as $obsId) {
            $allObs = DataStore::fetchAll('observations');
            foreach ($allObs as $i => $obs) {
                if (($obs['id'] ?? '') === $obsId && ($obs['user_id'] ?? '') === $guestData['guest_id']) {
                    $allObs[$i]['user_id'] = $user['id'];
                    $allObs[$i]['user_name'] = $user['name'];
                    $allObs[$i]['user_avatar'] = $user['avatar'] ?? $allObs[$i]['user_avatar'];
                    $allObs[$i]['updated_at'] = date('Y-m-d H:i:s');
                    $migratedCount++;
                }
            }
            if ($migratedCount > 0) {
                DataStore::save('observations', $allObs);
            }
        }
        
        // Sync gamification after migration
        require_once __DIR__ . '/../libs/Gamification.php';
        Gamification::syncUserStats($user['id']);
        
        // Redirect to post page with success message if came from there
        $redirect = 'index.php?migrated=' . $migratedCount;
    }

    header('Location: ' . $redirect);
    exit;
} catch (\Throwable $e) {
    // Log error (production would use proper logging)
    error_log('[OAuth Error] ' . $e->getMessage());

    $errorMsg = urlencode('ソーシャルログインに失敗しました。もう一度お試しください。');
    header("Location: login.php?error=oauth&msg={$errorMsg}");
    exit;
}

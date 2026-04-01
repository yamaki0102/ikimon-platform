<?php
declare(strict_types=1);

/**
 * GoogleAuth — Service Account JWT 認証ヘルパー
 * Google Analytics Data API など Google API の Bearer トークンを取得する
 */
class GoogleAuth
{
    /**
     * サービスアカウント JSON からアクセストークンを取得する
     *
     * @param string $credentialsPath サービスアカウント JSON のファイルパス
     * @param string $scope           要求するスコープ (例: https://www.googleapis.com/auth/analytics.readonly)
     */
    public static function getAccessToken(string $credentialsPath, string $scope): string
    {
        if (!file_exists($credentialsPath)) {
            throw new RuntimeException("Credentials file not found: {$credentialsPath}");
        }

        $creds = json_decode(file_get_contents($credentialsPath), true);
        if (!$creds || ($creds['type'] ?? '') !== 'service_account') {
            throw new RuntimeException('Invalid service account credentials JSON');
        }

        $now = time();
        $header  = self::base64url(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
        $payload = self::base64url(json_encode([
            'iss'   => $creds['client_email'],
            'scope' => $scope,
            'aud'   => 'https://oauth2.googleapis.com/token',
            'iat'   => $now,
            'exp'   => $now + 3600,
        ]));

        $signingInput = $header . '.' . $payload;
        $privateKey   = openssl_pkey_get_private($creds['private_key']);
        if ($privateKey === false) {
            throw new RuntimeException('Failed to load private key from credentials');
        }

        openssl_sign($signingInput, $signature, $privateKey, OPENSSL_ALGO_SHA256);
        $jwt = $signingInput . '.' . self::base64url($signature);

        $ch = curl_init('https://oauth2.googleapis.com/token');
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query([
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion'  => $jwt,
            ]),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
        ]);
        $raw      = curl_exec($ch);
        $curlErr  = curl_error($ch);
        curl_close($ch);

        if ($curlErr) {
            throw new RuntimeException("Token request curl error: {$curlErr}");
        }

        $response = json_decode($raw, true);
        if (empty($response['access_token'])) {
            throw new RuntimeException('Failed to get access token: ' . $raw);
        }

        return $response['access_token'];
    }

    private static function base64url(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}

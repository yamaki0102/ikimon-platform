<?php

/**
 * API Response Helper
 * 
 * Standardizes all API responses for consistency.
 * Usage: require_once 'ApiResponse.php';
 *        ApiResponse::success($data, 'Operation completed');
 *        ApiResponse::error('Not found', 404);
 */

class ApiResponse
{
    /**
     * Send a success response
     */
    public static function success(array $data = [], string $message = 'OK', int $code = 200): void
    {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => true,
            'message' => $message,
            'data' => $data,
        ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        exit;
    }

    /**
     * Send an error response
     */
    public static function error(string $message, int $code = 400, array $errors = []): void
    {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        $response = [
            'success' => false,
            'message' => $message,
            'error_code' => self::httpCodeToError($code),
        ];
        if (!empty($errors)) {
            $response['errors'] = $errors;
        }
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        exit;
    }

    /**
     * Map HTTP code to error string
     */
    private static function httpCodeToError(int $code): string
    {
        return match ($code) {
            400 => 'bad_request',
            401 => 'unauthorized',
            403 => 'forbidden',
            404 => 'not_found',
            409 => 'conflict',
            422 => 'validation_error',
            429 => 'rate_limited',
            500 => 'server_error',
            default => 'unknown_error',
        };
    }
}

/**
 * csrf.js — CSRF Protection Utility
 * 
 * Reads the csrf cookie and adds X-Csrf-Token header to fetch requests.
 * 
 * Usage:
 *   import { csrfFetch } from '/js/csrf.js';
 *   const res = await csrfFetch('/api/post_identification.php', {
 *     method: 'POST',
 *     body: JSON.stringify(data)
 *   });
 */

/**
 * Get CSRF token from cookie
 */
export function getCsrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)ikimon_csrf=([a-f0-9]{64})/);
    return match ? match[1] : '';
}

/**
 * Wrapper around fetch() that automatically adds CSRF token header
 */
export async function csrfFetch(url, options = {}) {
    const token = getCsrfToken();

    if (!options.headers) {
        options.headers = {};
    }

    // If headers is a Headers object, use set()
    if (options.headers instanceof Headers) {
        if (token) options.headers.set('X-Csrf-Token', token);
    } else {
        // Plain object
        if (token) options.headers['X-Csrf-Token'] = token;
    }

    return fetch(url, options);
}

/**
 * Add CSRF token to FormData for multipart/form-data submissions
 */
export function appendCsrfToFormData(formData) {
    const token = getCsrfToken();
    if (token) {
        formData.append('csrf_token', token);
    }
    return formData;
}

/**
 * ai-assist.js — AI同定ブリッジ フロントエンド
 * 
 * Phase B: 写真をai_suggest.php APIに送信し、
 * 分類候補をカード形式で表示する。
 * 
 * "Blind Review" パターン:
 * - ユーザーが自分で考えた後にだけAIボタンが有効になる
 * - AIの提案は参考情報であり、記録に自動反映されない
 * 
 * @version 1.0.0
 */

window.AiAssist = {
    /** State */
    loading: false,
    suggestions: [],
    asked: false,
    error: null,
    processingMs: 0,

    /**
     * Ask AI for identification suggestions.
     * Resizes photo to 512px client-side before upload.
     * 
     * @param {File[]} photos - Array of photo files from uploader
     */
    async ask(photos) {
        if (this.loading || !photos || photos.length === 0) return;

        // Offline check
        if (!navigator.onLine) {
            this.error = '📵 オフラインのため利用できません';
            return;
        }

        this.loading = true;
        this.error = null;
        this.suggestions = [];

        try {
            // Resize all photos to 512px on client side (privacy + speed)
            // Send up to 5 photos for better multi-angle analysis
            const maxPhotos = Math.min(photos.length, 5);
            const formData = new FormData();

            for (let i = 0; i < maxPhotos; i++) {
                const photo = photos[i];
                const resizedBlob = await this._resizeImage(photo.file || photo, 512);
                formData.append('photos[]', resizedBlob, `photo_${i}.jpg`);
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 20000); // 20s timeout

            const response = await fetch('api/ai_suggest.php', {
                method: 'POST',
                body: formData,
                signal: controller.signal,
            });

            clearTimeout(timeout);

            const data = await response.json().catch(() => null);

            if (response.status === 429) {
                this.error = '⏳ リクエストが多すぎます。少し待ってからお試しください。';
                return;
            }

            if (response.status === 503) {
                this.error = '🔧 AI機能は現在準備中です。';
                return;
            }

            if (!response.ok) {
                // Remove generic wrapper prefix if server provides a specific message
                this.error = (data && data.message) ? data.message : `通信エラー (HTTP ${response.status})`;
                return;
            }

            if (data && data.success && data.suggestions) {
                this.suggestions = data.suggestions;
                this.processingMs = data.meta?.processing_ms || 0;
                this.asked = true;
            } else {
                this.error = (data && data.message) ? data.message : 'AI分析に失敗しました。';
            }

        } catch (err) {
            if (err.name === 'AbortError') {
                this.error = '⏱️ タイムアウトしました。通信状況を確認してください。';
            } else {
                this.error = '🌐 通信エラー: ' + (err.message || '不明なエラー');
            }
            console.warn('[AiAssist] Error:', err);
        } finally {
            this.loading = false;
        }
    },

    /**
     * Apply a suggestion to the taxon name field.
     * This is a "hint" — user still confirms manually.
     */
    applySuggestion(suggestion, component) {
        if (component && suggestion.label) {
            // Set the taxon_name to the AI suggestion as a starting point
            component.taxon_name = suggestion.label;
            component.searchTaxon(); // Trigger autocomplete search
        }
    },

    /**
     * Reset state for new photo set.
     */
    reset() {
        this.loading = false;
        this.suggestions = [];
        this.asked = false;
        this.error = null;
        this.processingMs = 0;
    },

    /**
     * Get confidence label in Japanese.
     */
    confidenceLabel(level) {
        return {
            high: 'かなり確信',
            medium: 'たぶん',
            low: 'わからない',
        }[level] || '—';
    },

    /**
     * Get confidence color class.
     */
    confidenceColor(level) {
        return {
            high: 'text-emerald-700 bg-emerald-100',
            medium: 'text-amber-800 bg-amber-100',
            low: 'text-slate-600 bg-slate-100',
        }[level] || 'text-slate-600 bg-slate-100';
    },

    /**
     * Resize image to max dimension, strip EXIF, return as Blob.
     * @private
     */
    _resizeImage(file, maxDim) {
        return new Promise((resolve, reject) => {
            if (!file || (!(file instanceof Blob) && !(file instanceof File))) {
                return reject(new Error('有効な画像ファイルが選択されていません。'));
            }

            const img = new Image();
            const url = URL.createObjectURL(file);

            img.onload = () => {
                URL.revokeObjectURL(url);

                let w = img.naturalWidth;
                let h = img.naturalHeight;

                // Calculate new dimensions
                if (w > maxDim || h > maxDim) {
                    const ratio = Math.min(maxDim / w, maxDim / h);
                    w = Math.round(w * ratio);
                    h = Math.round(h * ratio);
                }

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);

                // Convert to JPEG blob (strips all EXIF)
                canvas.toBlob(
                    blob => blob ? resolve(blob) : reject(new Error('画像の変換処理に失敗しました。')),
                    'image/jpeg',
                    0.8
                );
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                if (file.name && file.name.toLowerCase().endsWith('.heic')) {
                    reject(new Error('HEIC形式は現在非対応です。iPhoneの設定で「互換性優先」を選択して撮影し直してください。'));
                } else {
                    reject(new Error('画像の読み込みに失敗しました。'));
                }
            };

            img.src = url;
        });
    },
};

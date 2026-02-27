/**
 * ai-assist.js — AI同定ブリッジ フロントエンド
 * 
 * Phase C: 複数写真をai_suggest.php APIに一括送信し、
 * 分類候補をカード形式で表示する。
 * 
 * @version 2.0.0 — Multi-Photo Support
 */

window.AiAssist = {
    loading: false,
    suggestions: [],
    asked: false,
    error: null,
    processingMs: 0,
    photoCount: 0,

    async ask(photos) {
        if (this.loading || !photos || photos.length === 0) return;
        if (!navigator.onLine) {
            this.error = '📵 オフラインのため利用できません';
            return;
        }
        this.loading = true;
        this.error = null;
        this.suggestions = [];
        try {
            const maxPhotos = Math.min(photos.length, 3);
            const formData = new FormData();
            for (let i = 0; i < maxPhotos; i++) {
                const photo = photos[i];
                const file = photo.file || photo;
                try {
                    const resizedBlob = await this._resizeImage(file, 512);
                    formData.append('photos[]', resizedBlob, `photo_${i}.jpg`);
                } catch (resizeErr) {
                    console.warn(`[AiAssist] Skipping photo ${i}:`, resizeErr.message);
                }
            }
            if (!formData.has('photos[]')) {
                this.error = '画像の処理に失敗しました。別の写真をお試しください。';
                return;
            }
            this.photoCount = maxPhotos;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 25000);
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

    applySuggestion(suggestion, component) {
        if (component && suggestion.label) {
            component.taxon_name = suggestion.label;
            component.searchTaxon();
        }
    },

    reset() {
        this.loading = false;
        this.suggestions = [];
        this.asked = false;
        this.error = null;
        this.processingMs = 0;
        this.photoCount = 0;
    },

    confidenceLabel(level) {
        return { high: 'かなり確信', medium: 'たぶん', low: 'わからない' }[level] || '—';
    },

    confidenceColor(level) {
        return {
            high: 'text-emerald-700 bg-emerald-100',
            medium: 'text-amber-800 bg-amber-100',
            low: 'text-slate-600 bg-slate-100',
        }[level] || 'text-slate-600 bg-slate-100';
    },

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
                canvas.toBlob(
                    blob => blob ? resolve(blob) : reject(new Error('画像の変換処理に失敗しました。')),
                    'image/jpeg',
                    0.8
                );
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                if (file.name && file.name.toLowerCase().endsWith('.heic')) {
                    reject(new Error('HEIC形式は現在非対応です。'));
                } else {
                    reject(new Error('画像の読み込みに失敗しました。'));
                }
            };
            img.src = url;
        });
    },
};

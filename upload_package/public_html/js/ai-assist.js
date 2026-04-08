/**
 * ai-assist.js — AI同定 + 環境推定ブリッジ フロントエンド
 *
 * Phase B+: 写真をai_suggest.php APIに送信し、
 * 分類候補 + 環境情報をカード形式で表示・自動入力する。
 *
 * @version 2.1.0
 */

window.AiAssist = {
    /** State */
    loading: false,
    suggestions: [],
    environment: null,
    environmentApplied: false,
    asked: false,
    error: null,
    processingMs: 0,

    /**
     * Ask AI for identification + environment suggestions.
     * Resizes photo to 512px client-side before upload.
     *
     * @param {Object[]} photos - Array of photo objects from uploader
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
        this.environment = null;
        this.environmentApplied = false;

        try {
            const formData = new FormData();
            const maxPhotos = Math.min(photos.length, 3);

            for (let i = 0; i < maxPhotos; i++) {
                const photo = photos[i];
                let fileObj = photo.file || photo;
                try {
                    if (typeof Alpine !== 'undefined' && Alpine.raw) {
                        fileObj = Alpine.raw(fileObj);
                    }
                } catch (e) { /* ignore unwrap failure */ }

                let blob;
                try {
                    blob = await this._resizeImage(fileObj, 512);
                } catch (resizeErr) {
                    console.warn(`[AiAssist] Resize failed for photo ${i}, trying preview fallback:`, resizeErr.message);
                    if (photo.preview) {
                        blob = await this._dataUrlToBlob(photo.preview);
                    }
                    if (!blob) continue;
                }
                formData.append('photos[]', blob, `photo_${i}.jpg`);
            }

            if (!formData.has('photos[]')) {
                this.error = '画像の処理に失敗しました。';
                return;
            }

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
                this.environment = data.environment || null;
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
     */
    applySuggestion(suggestion, component) {
        if (component && suggestion.label) {
            component.taxon_name = suggestion.label;
            component.searchTaxon();
        }
    },

    /**
     * Apply environment data to the form fields.
     * Called once when user taps the environment card.
     */
    applyEnvironment(component) {
        if (!this.environment || !component) return;

        const env = this.environment;

        if (env.biome && env.biome !== 'unknown') {
            component.biome = env.biome;
        }
        if (env.cultivation) {
            component.cultivation = env.cultivation;
            if (env.cultivation === 'cultivated' && component.organism_origin === 'wild') {
                component.organism_origin = 'cultivated';
            }
        }
        if (env.life_stage && env.life_stage !== 'unknown') {
            component.life_stage = env.life_stage;
        }
        if (env.substrate_tags && env.substrate_tags.length > 0) {
            component.substrate_tags = [...env.substrate_tags];
        }

        this.environmentApplied = true;
    },

    /**
     * Reset state for new photo set.
     */
    reset() {
        this.loading = false;
        this.suggestions = [];
        this.environment = null;
        this.environmentApplied = false;
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

    /** Biome label map */
    biomeLabel(val) {
        return {
            forest: '🌲 森林',
            grassland: '🍃 草地・河川敷',
            wetland: '💧 湿地・水辺',
            coastal: '🌊 海岸・干潟',
            urban: '🏢 都市・公園',
            farmland: '🌾 農地・里山',
        }[val] || null;
    },

    /** Cultivation label */
    cultivationLabel(val) {
        return val === 'cultivated' ? '🌷 植栽・飼育' : '🌿 野生';
    },

    /** Life stage label */
    lifeStageLabel(val) {
        return {
            adult: '👑 成体',
            juvenile: '🌱 幼体',
            egg: '⚪ 卵・種子',
            trace: '🐾 痕跡',
        }[val] || null;
    },

    /** Substrate tag label */
    substrateLabel(val) {
        return {
            rock: '🪨 岩場', sand: '🏖️ 砂地', gravel: '🫘 砂利', grass: '🌿 草地',
            leaf_litter: '🍂 落ち葉', deadwood: '🪵 倒木', water: '💧 水辺', artificial: '🏗️ 人工物',
        }[val] || val;
    },

    /**
     * Resize image to max dimension, strip EXIF, return as Blob.
     * @private
     */
    _resizeImage(file, maxDim) {
        return new Promise((resolve, reject) => {
            if (!file) {
                return reject(new Error('有効な画像ファイルが選択されていません。'));
            }

            // Try ObjectURL approach (works for File/Blob objects)
            let url;
            try {
                url = URL.createObjectURL(file);
            } catch (e) {
                return reject(new Error('画像の読み込み準備に失敗しました。'));
            }

            const img = new Image();

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
                    reject(new Error('HEIC形式は現在非対応です。iPhoneの設定で「互換性優先」を選択して撮影し直してください。'));
                } else {
                    reject(new Error('画像の読み込みに失敗しました。'));
                }
            };

            img.src = url;
        });
    },

    /**
     * Convert a data URL (from FileReader) to a Blob.
     * Used as fallback when _resizeImage fails.
     * @private
     */
    _dataUrlToBlob(dataUrl) {
        return new Promise((resolve, reject) => {
            try {
                const img = new Image();
                img.onload = () => {
                    const maxDim = 512;
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
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    canvas.toBlob(
                        blob => blob ? resolve(blob) : reject(new Error('フォールバック変換に失敗')),
                        'image/jpeg', 0.8
                    );
                };
                img.onerror = () => reject(new Error('フォールバック読み込みに失敗'));
                img.src = dataUrl;
            } catch (e) {
                reject(e);
            }
        });
    },
};

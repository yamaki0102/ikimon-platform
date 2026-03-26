/**
 * post-uploader.js — ikimon.life 投稿フォーム Alpine.js コンポーネント
 * post.php から分離。PHP動的値は window.__POST_CONFIG 経由で注入。
 * @version 4.0 — Multi-Photo Intelligence (GPS best-select + burst detect + session link)
 */
function uploader() {
    const config = window.__POST_CONFIG || {};
    return {
        AiAssist: window.AiAssist,
        photos: [],
        observed_at: '',
        lat: '34.7108',
        lng: '137.7261',
        cultivation: 'wild',
        organism_origin: 'wild',
        managed_context_type: '',
        managed_site_id: '',
        managed_site_name: '',
        managed_context_note: '',
        life_stage: 'unknown',
        taxon_name: '',
        taxon_slug: '',
        taxon_rank: '',
        taxon_source: '',
        inat_taxon_id: null,
        taxon_thumbnail: '',
        suggestions: [],
        showSuggestions: false,
        searchTimer: null,
        note: '',
        license: 'CC-BY',
        event_id: null,
        event_name: '',
        locationName: '',
        addressQuery: '',
        addressResults: [],
        showAddressSuggestions: false,
        gpsAccuracy: null,
        locationSource: 'default',
        exifToast: '',
        exifToastVisible: false,
        deviceGps: null,
        // GPS conflict modal state
        gpsConflict: false,
        gpsConflictData: null,   // { exifLat, exifLng, deviceLat, deviceLng, distance }
        // Date discrepancy warning
        dateWarning: '',
        dateWarningVisible: false,
        // Soft Validation Alarms (Ecological Constraints)
        validationWarnings: [], // AI validation warnings
        validating: false, // AI validating state
        validationTimer: null,
        hasConstraints: false, // Whether the taxon has ecological constraints
        // Multi-Photo Intelligence state
        _exifData: [],           // EXIF data from all photos [{lat, lng, date, orientation, imgDirection}]
        _burstDetected: false,   // True if consecutive photos <30s apart
        activeSessionId: null,   // Free Roam session auto-link
        lastObservationId: null,
        submitting: false,
        progress: 0,
        success: false,
        aiReady: false,
        aiPending: false,
        aiSummary: '',
        aiPollTimer: null,
        map: null,
        marker: null,
        isLoggedIn: config.isLoggedIn ?? false,
        isGuest: config.isGuest ?? true,
        guestPostCount: config.guestPostCount ?? 0,
        guestPostLimit: config.guestPostLimit ?? 3,
        csrfToken: config.csrfToken ?? '',
        survey_id: config.survey_id ?? null,
        showDetails: false,
        biome: 'unknown',
        biomeAutoSelected: false,
        biomeAutoReason: '',
        substrate_tags: [],
        evidence_tags: [],
        individual_count: null,
        record_mode: 'standard',
        canSurveyorOfficialPost: config.canSurveyorOfficialPost ?? false,

        async loadHistory() {
            if (!this.isLoggedIn) {
                alert('履歴を見るにはログインしてね 🔑\n投稿は誰でもできるよ！');
                return;
            }
            try {
                const res = await fetch('api/get_last_observation.php');
                const json = await res.json();
                if (json.success) {
                    const d = json.data;
                    this.lat = d.lat;
                    this.lng = d.lng;
                    this.cultivation = d.cultivation;
                    this.organism_origin = d.organism_origin || this.organism_origin;
                    this.managed_context_type = d.managed_context?.type || '';
                    this.managed_site_id = d.managed_context?.site_id || '';
                    this.managed_site_name = d.managed_context?.site_name || '';
                    if (this.map && this.marker) {
                        this.map.flyTo([this.lat, this.lng], 16);
                        this.marker.setLatLng([this.lat, this.lng]);
                    }
                }
            } catch (e) { }
        },

        init() {
            // URL params (from id_wizard etc.)
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('taxon_name')) this.taxon_name = urlParams.get('taxon_name');
            if (urlParams.get('note')) this.note = urlParams.get('note');
            if (urlParams.get('event_id')) {
                this.event_id = urlParams.get('event_id');
                this.event_name = urlParams.get('event_name') || '観察会';
            }

            // 日時を現在時刻にプリセット
            const now = new Date();
            this.observed_at = now.getFullYear() + '-' +
                String(now.getMonth() + 1).padStart(2, '0') + '-' +
                String(now.getDate()).padStart(2, '0') + 'T' +
                String(now.getHours()).padStart(2, '0') + ':' +
                String(now.getMinutes()).padStart(2, '0');

            // GPS自動取得
            if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        this.lat = pos.coords.latitude.toFixed(6);
                        this.lng = pos.coords.longitude.toFixed(6);
                        this.gpsAccuracy = pos.coords.accuracy;
                        this.locationSource = 'gps';
                        this.deviceGps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                        this.reverseGeocode(this.lat, this.lng);
                        if (this.map && this.marker) {
                            this.map.flyTo([this.lat, this.lng], 15);
                            this.marker.setLatLng([this.lat, this.lng]);
                        }
                    },
                    () => {
                        /* 失敗時は静かにデフォルト座標を維持 */
                    }, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000
                }
                );
            }

            // Draft Recovery
            const draft = localStorage.getItem('draft_obs');
            if (draft) {
                try {
                    const d = JSON.parse(draft);
                    if (d.note) this.note = d.note;
                    if (d.cultivation) this.cultivation = d.cultivation;
                    if (d.organism_origin) this.organism_origin = d.organism_origin;
                } catch (e) { }
            }

            // Free Roam Session auto-link: check localStorage for active session
            try {
                const activeSession = localStorage.getItem('ikimon_active_session');
                if (activeSession) {
                    const session = JSON.parse(activeSession);
                    if (session.id && session.status === 'active') {
                        this.activeSessionId = session.id;
                        console.log('[Session Link] Active session found:', session.id);
                    }
                }
            } catch (e) { /* no active session */ }

            // Auto-Save Draft
            this.$watch('note', val => this.saveDraft());
            this.$watch('cultivation', val => this.saveDraft());
            this.$watch('organism_origin', val => this.saveDraft());
            this.$watch('cultivation', () => this.autoSelectBiome());
            this.$watch('managed_context_type', () => this.autoSelectBiome());
            this.$watch('locationName', () => this.autoSelectBiome());

            // Soft Validation Triggers
            this.$watch('taxon_slug', () => this.triggerValidation());
            this.$watch('taxon_name', () => this.triggerValidation());
            this.$watch('observed_at', () => this.triggerValidation());
            this.$watch('lat', () => this.triggerValidation());
            this.$watch('lng', () => this.triggerValidation());

            // Camera shortcut: post.php?camera=1 → auto-open camera
            if (urlParams.get('camera') === '1') {
                this.$nextTick(() => {
                    if (this.$refs.cameraInput) this.$refs.cameraInput.click();
                });
            }

            // 調査員公式記録は写真なしでもフォームを開ける
            if (this.canSurveyorOfficialPost && this.record_mode === 'surveyor_official' && !this.map) {
                this.$nextTick(() => {
                    setTimeout(() => this.initMapNow(), 200);
                });
            }
        },

        get canOpenForm() {
            return this.photos.length > 0 || (this.canSurveyorOfficialPost && this.record_mode === 'surveyor_official');
        },

        get canSubmit() {
            if (!this.canOpenForm) return false;
            if (this.record_mode !== 'surveyor_official') {
                return this.photos.length > 0;
            }

            const hasLocation = !!this.lat && !!this.lng;
            const hasSubstance = this.photos.length > 0 || this.taxon_name.trim().length > 0 || this.note.trim().length > 0;
            return hasLocation && hasSubstance;
        },

        ensureFormReady() {
            if (!this.map) {
                this.$nextTick(() => {
                    setTimeout(() => this.initMapNow(), 200);
                });
            }
            this.showDetails = true;
        },

        initMapNow() {
            const container = document.getElementById('map');
            if (!container || container.offsetWidth === 0) {
                setTimeout(() => this.initMapNow(), 100);
                return;
            }
            // Fix Leaflet default marker icon (CDN path resolution issue)
            delete L.Icon.Default.prototype._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                iconUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png',
                shadowUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png',
            });
            this.map = L.map('map').setView([this.lat, this.lng], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap',
                maxZoom: 19
            }).addTo(this.map);

            this.marker = L.marker([this.lat, this.lng], {
                draggable: true
            }).addTo(this.map);

            this.marker.on('dragend', () => {
                const pos = this.marker.getLatLng();
                this.lat = pos.lat.toFixed(6);
                this.lng = pos.lng.toFixed(6);
                this.locationSource = 'manual';
                this.reverseGeocode(this.lat, this.lng);
                if (navigator.vibrate) navigator.vibrate(10);
            });
            this.map.on('click', (e) => {
                this.marker.setLatLng(e.latlng);
                this.lat = e.latlng.lat.toFixed(6);
                this.lng = e.latlng.lng.toFixed(6);
                this.locationSource = 'manual';
                this.reverseGeocode(this.lat, this.lng);
                if (navigator.vibrate) navigator.vibrate(10);
            });

            // Ensure tiles render after container appears
            setTimeout(() => this.map.invalidateSize(), 200);
        },

        async reverseGeocode(lat, lng) {
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16&accept-language=ja`);
                const data = await res.json();
                if (data.address) {
                    const a = data.address;
                    this.locationName = [a.city || a.town || a.village, a.suburb || a.neighbourhood || a.hamlet].filter(Boolean).join(' ') || data.display_name?.split(',').slice(0, 2).join(', ') || '';
                }
            } catch (e) {
                /* Silent fail */
            }
        },

        async searchAddress() {
            const q = this.addressQuery.trim();
            if (q.length < 2) {
                this.addressResults = [];
                this.showAddressSuggestions = false;
                return;
            }
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&countrycodes=jp&limit=5&accept-language=ja`);
                this.addressResults = await res.json();
                this.showAddressSuggestions = this.addressResults.length > 0;
                this.$nextTick(() => lucide.createIcons());
            } catch (e) {
                this.addressResults = [];
            }
        },

        selectAddress(addr) {
            this.lat = parseFloat(addr.lat).toFixed(6);
            this.lng = parseFloat(addr.lon).toFixed(6);
            this.locationName = addr.display_name.split(',').slice(0, 3).join(', ');
            this.addressQuery = '';
            this.showAddressSuggestions = false;
            this.locationSource = 'manual';
            if (this.map && this.marker) {
                this.map.flyTo([this.lat, this.lng], 16);
                this.marker.setLatLng([this.lat, this.lng]);
            }
            if (navigator.vibrate) navigator.vibrate(30);
            this.autoSelectBiome();
        },

        resetForm() {
            this.photos = [];
            this.taxon_name = '';
            this.taxon_slug = '';
            this.taxon_rank = '';
            this.taxon_source = '';
            this.inat_taxon_id = null;
            this.taxon_thumbnail = '';
            this.note = '';
            this.license = 'CC-BY';
            this.life_stage = 'unknown';
            this.cultivation = 'wild';
            this.organism_origin = 'wild';
            this.managed_context_type = '';
            this.managed_site_id = '';
            this.managed_site_name = '';
            this.managed_context_note = '';
            this.biome = 'unknown';
            this.substrate_tags = [];
            this.evidence_tags = [];
            this.individual_count = null;
            this.record_mode = 'standard';
            this.showDetails = false;
            this.submitting = false;
            this.success = false;
            this.progress = 0;
            this.lastObservationId = null;
            this.aiReady = false;
            this.aiPending = false;
            this.aiSummary = '';
            this.biomeAutoSelected = false;
            this.biomeAutoReason = '';
            if (this.aiPollTimer) {
                clearTimeout(this.aiPollTimer);
                this.aiPollTimer = null;
            }
            this.event_id = null;
            this.event_name = '';
            const now = new Date();
            this.observed_at = now.getFullYear() + '-' +
                String(now.getMonth() + 1).padStart(2, '0') + '-' +
                String(now.getDate()).padStart(2, '0') + 'T' +
                String(now.getHours()).padStart(2, '0') + ':' +
                String(now.getMinutes()).padStart(2, '0');
            this.$nextTick(() => lucide.createIcons());
        },

        saveDraft() {
            localStorage.setItem('draft_obs', JSON.stringify({
                note: this.note,
                cultivation: this.cultivation,
                organism_origin: this.organism_origin,
                timestamp: Date.now()
            }));
        },

        handleFiles(e) {
            if (navigator.vibrate) navigator.vibrate(50);
            const files = Array.from(e.target.files);
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const photo = {
                        file: file,
                        preview: ev.target.result,
                        size: file.size,
                        compressed: false,
                        blob: null
                    };
                    this.photos.push(photo);
                    this.compressPhoto(photo);
                    // AI Assist: 写真変更時にリセット
                    if (window.AiAssist) AiAssist.reset();
                    // Analytics: 写真追加イベント
                    if (window.ikimonAnalytics) ikimonAnalytics.track('photo_added', {
                        count: this.photos.length
                    });

                    // Init map when first photo is added (container becomes visible)
                    if (this.photos.length === 1 && !this.map) {
                        setTimeout(() => this.initMapNow(), 300);
                    }

                    // Multi-Photo EXIF Intelligence — process ALL photos
                    if (typeof EXIF !== 'undefined') {
                        this._processExif(file, this.photos.length);
                    }
                    this.autoSelectBiome();
                };
                reader.readAsDataURL(file);
            });
        },

        removePhoto(index) {
            this.photos.splice(index, 1);
            if (navigator.vibrate) navigator.vibrate(20);
        },

        async compressPhoto(photo) {
            const img = new Image();
            img.src = photo.preview;
            await new Promise(resolve => img.onload = resolve);
            const canvas = document.createElement('canvas');
            let w = img.width;
            let h = img.height;
            const max = 1280;
            if (w > max || h > max) {
                if (w > h) {
                    h = Math.round(h * max / w);
                    w = max;
                } else {
                    w = Math.round(w * max / h);
                    h = max;
                }
            }
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            canvas.toBlob(b => {
                photo.blob = b;
                photo.compressed = true;
            }, 'image/webp', 0.8);
        },

        redirectToLogin() {
            window.location.href = 'login.php?redirect=' + encodeURIComponent('post.php');
        },

        async submit() {
            // ゲスト上限チェック (サーバー側でも検証するが、UXのためクライアント側でも)
            if (this.isGuest && this.guestPostCount >= this.guestPostLimit) {
                if (confirm('ゲストの投稿上限(' + this.guestPostLimit + '件)に達したよ！\nログインすると無制限に投稿できるよ 🔑')) {
                    this.redirectToLogin();
                }
                return;
            }

            // Evidence Validation (同定入力時必須)
            const isNameEntered = this.taxon_name.trim().length > 0;
            if (isNameEntered && this.evidence_tags.length === 0) {
                alert('同定の精度を高めるため、「同定のエビデンス（証拠）」を1つ以上選択してください 🙇\n\n（「全体的な形」「生息環境」など決め手になった特徴を選んでね）');
                return;
            }

            if (navigator.vibrate) navigator.vibrate(50);

            this.submitting = true;
            // Analytics: 投稿送信イベント
            if (window.ikimonAnalytics) ikimonAnalytics.track('post_submit', {
                photo_count: this.photos.length,
                has_taxon: !!this.taxon_name,
                record_mode: this.record_mode
            });

            const formData = new FormData();
            formData.append('observed_at', this.observed_at || new Date().toISOString().slice(0, 16));
            console.log('[SUBMIT] lat:', this.lat, 'lng:', this.lng, 'type:', typeof this.lat);
            formData.append('lat', this.lat);
            formData.append('lng', this.lng);
            formData.append('csrf_token', this.csrfToken);
            formData.append('cultivation', this.cultivation);
            formData.append('organism_origin', this.organism_origin);
            if (this.managed_context_type) formData.append('managed_context_type', this.managed_context_type);
            if (this.managed_site_id) formData.append('managed_site_id', this.managed_site_id);
            if (this.managed_site_name) formData.append('managed_site_name', this.managed_site_name);
            if (this.managed_context_note) formData.append('managed_context_note', this.managed_context_note);
            formData.append('life_stage', this.life_stage);
            formData.append('taxon_name', this.taxon_name);
            formData.append('taxon_slug', this.taxon_slug);
            if (this.taxon_rank) formData.append('taxon_rank', this.taxon_rank);
            if (this.taxon_source) formData.append('taxon_source', this.taxon_source);
            if (this.inat_taxon_id) formData.append('inat_taxon_id', this.inat_taxon_id);
            if (this.taxon_thumbnail) formData.append('taxon_thumbnail', this.taxon_thumbnail);
            formData.append('note', this.note);
            formData.append('license', this.license);
            if (this.event_id) formData.append('event_id', this.event_id);
            if (this.survey_id) formData.append('survey_id', this.survey_id);
            if (this.activeSessionId) formData.append('session_id', this.activeSessionId);
            if (this.biome && this.biome !== 'unknown') formData.append('biome', this.biome);
            if (this.biomeAutoSelected) formData.append('biome_auto_selected', '1');
            if (this.biomeAutoReason) formData.append('biome_auto_reason', this.biomeAutoReason);
            if (this.substrate_tags.length > 0) formData.append('substrate_tags', JSON.stringify(this.substrate_tags));
            if (this.evidence_tags.length > 0) formData.append('evidence_tags', JSON.stringify(this.evidence_tags));
            if (this.individual_count !== null && this.individual_count !== '') formData.append('individual_count', this.individual_count);
            formData.append('record_mode', this.record_mode);

            // NP: Send GPS coordinate accuracy for DwC coordinateUncertaintyInMeters
            if (this.gpsAccuracy !== null) formData.append('coordinate_accuracy', Math.round(this.gpsAccuracy));

            // AI Assist: 提案データを記録に添付（精度評価ループ用）
            if (window.AiAssist && AiAssist.asked && AiAssist.suggestions.length > 0) {
                formData.append('ai_hint', JSON.stringify({
                    suggestions: AiAssist.suggestions,
                    processing_ms: AiAssist.processingMs
                }));
            }

            // Use compressed blob if available, else original
            for (let i = 0; i < this.photos.length; i++) {
                const photo = this.photos[i];
                if (photo.compressed && photo.blob) {
                    formData.append('photos[]', photo.blob, `photo_${i}.webp`);
                } else {
                    formData.append('photos[]', photo.file);
                }
            }

            // Network Logic with Offline Fallback
            try {
                if (this.validationWarnings.length === 0 && this.hasConstraints && !this.validating && this.taxon_slug) {
                    formData.append('ecological_verified', '1');
                }
                const res = await fetch('api/post_observation.php', {
                    method: 'POST',
                    body: formData
                });

                const text = await res.text();
                let result;
                try {
                    result = JSON.parse(text);
                } catch (e) {
                    // Server returned non-JSON (500 error, HTML error page, etc.)
                    console.error('Server Error (non-JSON):', text.slice(0, 200));
                    alert('サーバーエラーが発生したよ 🙇\nもう一度試してみてね。\n\n' + text.slice(0, 80));
                    this.submitting = false;
                    return;
                }

                if (result.success) {
                    this.lastObservationId = result.id;
                    this.aiReady = !!result.ai_assessment_ready;
                    this.aiPending = !!result.ai_assessment_pending && !this.aiReady;
                    this.aiSummary = result.ai_assessment_summary || '';

                    // Dispatch Gamification Event if present
                    if (result.gamification_events && result.gamification_events.length > 0) {
                        window.dispatchEvent(new CustomEvent('gamification-event', {
                            detail: result.gamification_events
                        }));
                    }

                    // Analytics: 投稿成功イベント
                    if (window.ikimonAnalytics) ikimonAnalytics.track('post_success', {
                        obs_id: result.id
                    });
                    this.completeSubmission();
                    if (this.aiPending && this.lastObservationId) {
                        this.scheduleAiStatusPoll();
                    }
                } else {
                    console.error('Submission Failed:', result);
                    alert('ごめん、ちょっとうまくいかなかった 🙇\n' + (result.message || result.error || 'もう一度試してみてね'));
                    this.submitting = false;
                }
            } catch (e) {
                // TypeError from fetch = genuine network failure (DNS, no connection, etc.)
                // Only save to offline queue for actual network errors
                if (e instanceof TypeError || !navigator.onLine) {
                    console.log('Network unavailable, saving to Outbox...', e);
                    try {
                        await window.offlineManager.saveObservation(formData);
                        this.progress = 100;
                        this.success = true;
                        if (navigator.vibrate) navigator.vibrate([50, 50]);
                        alert('📱 端末に保存したよ！\nネットが繋がったら自動で送信されるから安心してね。');
                        localStorage.removeItem('draft_obs');
                        setTimeout(() => window.location.href = 'index.php', 500);
                    } catch (dbError) {
                        console.error('IndexedDB Failed:', dbError);
                        alert('ごめん、保存がうまくいかなかった... 🙇\nもう一回試してみてね');
                        this.submitting = false;
                    }
                } else {
                    // Non-network error (e.g. CORS, abort, etc.)
                    console.error('Submit error (not network):', e);
                    alert('送信エラーが発生したよ 🙇\n' + e.message + '\n\nもう一度試してみてね。');
                    this.submitting = false;
                }
            }
        },

        completeSubmission() {
            this.progress = 100;
            this.success = true;
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            localStorage.removeItem('draft_obs');
            // ゲスト投稿カウントをクライアント側でも更新
            if (this.isGuest) {
                this.guestPostCount++;
            }
            this.$nextTick(() => lucide.createIcons());
        },

        scheduleAiStatusPoll(delay = 1200) {
            if (!this.lastObservationId) return;
            if (this.aiPollTimer) clearTimeout(this.aiPollTimer);
            this.aiPollTimer = setTimeout(() => this.pollAiStatus(8), delay);
        },

        async pollAiStatus(remaining = 8) {
            if (!this.lastObservationId || remaining <= 0) {
                this.aiPending = false;
                return;
            }
            try {
                const res = await fetch('api/get_observation_ai_status.php?id=' + encodeURIComponent(this.lastObservationId), {
                    cache: 'no-store'
                });
                const data = await res.json();
                if (data.success && data.ready) {
                    this.aiReady = true;
                    this.aiPending = false;
                    this.aiSummary = data.summary || '';
                    this.$nextTick(() => lucide.createIcons());
                    return;
                }
            } catch (e) {
                console.warn('AI status poll failed', e);
            }
            if (remaining > 1) {
                if (this.aiPollTimer) clearTimeout(this.aiPollTimer);
                this.aiPollTimer = setTimeout(() => this.pollAiStatus(remaining - 1), 1200);
                return;
            }
            this.aiPending = false;
        },

        autoSelectBiome() {
            if (this.biome && this.biome !== 'unknown' && !this.biomeAutoSelected) return;

            const managed = (this.managed_context_type || '').toLowerCase();
            const location = (this.locationName || this.addressQuery || '').toLowerCase();
            let next = 'unknown';
            let reason = '';

            if (managed === 'aquarium') {
                next = 'wetland';
                reason = '施設文脈から水辺寄りとして自動選択';
            } else if (['botanical_garden', 'zoo', 'aviary', 'park_planting', 'school_biotope', 'private_collection'].includes(managed)) {
                next = 'urban';
                reason = '施設文脈から都市・公園寄りとして自動選択';
            } else if (managed === 'conservation_center') {
                next = 'forest';
                reason = '施設文脈から森林寄りとして自動選択';
            } else if (this.cultivation === 'cultivated') {
                next = 'urban';
                reason = '植栽・飼育のため都市・公園寄りとして自動選択';
            } else if (/[海浜湾港干潟]/.test(location)) {
                next = 'coastal';
                reason = '場所名から海岸・干潟を自動選択';
            } else if (/[池沼沢川河湖湿]/.test(location)) {
                next = 'wetland';
                reason = '場所名から湿地・水辺を自動選択';
            } else if (/[田畑果樹農]/.test(location)) {
                next = 'farmland';
                reason = '場所名から農地・里山を自動選択';
            } else if (/[森林山神社寺]/.test(location)) {
                next = 'forest';
                reason = '場所名から森林を自動選択';
            } else if (location) {
                next = 'urban';
                reason = '場所名から都市・公園寄りとして自動選択';
            }

            this.biomeAutoSelected = next !== 'unknown';
            this.biomeAutoReason = this.biomeAutoSelected ? reason : '';
            if (this.biomeAutoSelected) {
                this.biome = next;
            }
        },

        async searchTaxon() {
            const q = this.taxon_name.trim();
            if (q.length < 1) {
                this.suggestions = [];
                this.showSuggestions = false;
                return;
            }
            this.taxon_slug = '';
            this.taxon_rank = '';
            this.taxon_source = '';
            this.inat_taxon_id = null;
            this.taxon_thumbnail = '';
            try {
                const res = await fetch('api/taxon_suggest.php?q=' + encodeURIComponent(q));
                const data = await res.json();
                this.suggestions = data.results || [];
                this.showSuggestions = this.suggestions.length > 0;
            } catch (e) {
                this.suggestions = [];
            }
        },

        selectTaxon(s) {
            this.taxon_name = s.jp_name || s.sci_name;
            this.taxon_slug = s.slug;
            this.taxon_rank = s.rank || '';
            this.taxon_source = s.source || '';
            this.inat_taxon_id = s.inat_taxon_id || null;
            this.taxon_thumbnail = s.thumbnail_url || '';
            this.showSuggestions = false;
            if (navigator.vibrate) navigator.vibrate(30);
        },

        originLabel(origin) {
            return {
                wild: '野生',
                cultivated: '栽培個体',
                captive: '飼育個体',
                released: '放された個体',
                escaped: '逸出個体',
                naturalized: '野外定着',
                uncertain: '判断保留',
            }[origin] || '未設定';
        },

        toggleSubstrate(tagId) {
            const idx = this.substrate_tags.indexOf(tagId);
            if (idx >= 0) {
                this.substrate_tags.splice(idx, 1);
            } else {
                this.substrate_tags.push(tagId);
            }
            if (navigator.vibrate) navigator.vibrate(15);
        },

        toggleEvidence(tagId) {
            const idx = this.evidence_tags.indexOf(tagId);
            if (idx >= 0) {
                this.evidence_tags.splice(idx, 1);
            } else {
                this.evidence_tags.push(tagId);
            }
            if (navigator.vibrate) navigator.vibrate(15);
        },

        triggerValidation() {
            if (!this.taxon_name && !this.taxon_slug) {
                this.validationWarnings = [];
                return;
            }
            clearTimeout(this.validationTimer);
            this.validationTimer = setTimeout(() => {
                this.validateObservation();
            }, 1500); // 1.5s debounce
        },

        async validateObservation() {
            if (!this.taxon_name && !this.taxon_slug) return;
            if (!this.lat || !this.lng || !this.observed_at) return;

            this.validating = true;
            const formData = new FormData();
            formData.append('taxon_name', this.taxon_name);
            formData.append('taxon_slug', this.taxon_slug);
            formData.append('sci_name', this.taxon_name); // Simplified fallback
            formData.append('lat', this.lat);
            formData.append('lng', this.lng);
            formData.append('observed_at', this.observed_at);

            try {
                const res = await fetch('api/validate_observation.php', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                this.validationWarnings = data.warnings || [];
                this.hasConstraints = data.has_constraints || false;
            } catch (e) {
                console.warn('Validation API failed', e);
                this.validationWarnings = [];
            } finally {
                this.validating = false;
                this.$nextTick(() => lucide.createIcons());
            }
        },

        /**
         * Multi-Photo EXIF processor — called for each photo
         * Handles: GPS best-selection, burst detection, date extraction, conflict modal
         */
        async _processExif(file, photoIndex) {
            try {
                const exif = await EXIF.readFromFile(file);
                const entry = {
                    index: photoIndex,
                    lat: exif.lat,
                    lng: exif.lng,
                    date: exif.date || null,
                    orientation: exif.orientation || null,
                    imgDirection: exif.imgDirection || null
                };
                this._exifData.push(entry);
                console.log(`[EXIF #${photoIndex}]`, entry);

                const isFirstPhoto = (photoIndex === 1);
                const toastParts = [];

                // === Date: use first photo's date ===
                if (isFirstPhoto && exif.date) {
                    try {
                        const parts = exif.date.split(' ');
                        const dt = parts[0].replace(/:/g, '-') + 'T' + parts[1].slice(0, 5);
                        this.observed_at = dt;
                        toastParts.push('🕐 撮影日時');
                    } catch (e) { /* ignore parse errors */ }

                    // Date discrepancy warning (>24h old photo)
                    try {
                        const parts = exif.date.split(' ');
                        const exifDate = new Date(parts[0].replace(/:/g, '-') + 'T' + parts[1]);
                        const hoursAgo = (Date.now() - exifDate.getTime()) / (1000 * 60 * 60);
                        if (hoursAgo > 24) {
                            const daysAgo = Math.floor(hoursAgo / 24);
                            this.dateWarning = daysAgo === 1
                                ? '⏰ この写真は昨日撮影されたものです'
                                : `⏰ この写真は${daysAgo}日前に撮影されたものです`;
                            this.dateWarningVisible = true;
                            setTimeout(() => { this.dateWarningVisible = false; }, 6000);
                        }
                    } catch (e) { /* ignore */ }
                }

                // === GPS: best-selection across all photos ===
                if (exif.lat !== null && exif.lng !== null) {
                    const absLat = Math.abs(exif.lat);
                    const absLng = Math.abs(exif.lng);
                    const isNullIsland = (absLat < 0.01 && absLng < 0.01);
                    const isOutOfRange = (absLat > 90 || absLng > 180);

                    if (!isNullIsland && !isOutOfRange) {
                        // For first photo with valid GPS, or if no GPS was set yet from EXIF
                        const hasExifGps = this.locationSource === 'exif';
                        if (!hasExifGps) {
                            console.log(`[EXIF GPS #${photoIndex}] Using as primary:`, exif.lat, exif.lng);
                            if (this.deviceGps) {
                                const dist = this._haversine(
                                    this.deviceGps.lat, this.deviceGps.lng,
                                    exif.lat, exif.lng
                                );
                                console.log('[EXIF vs Device GPS] distance:', Math.round(dist), 'm');
                                if (dist > 500) {
                                    this.gpsConflictData = {
                                        exifLat: exif.lat, exifLng: exif.lng,
                                        deviceLat: this.deviceGps.lat, deviceLng: this.deviceGps.lng,
                                        distance: Math.round(dist)
                                    };
                                    this.gpsConflict = true;
                                    if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
                                }
                            }
                            this._applyExifGps(exif.lat, exif.lng);
                            toastParts.push('📍 撮影場所');
                        } else {
                            console.log(`[EXIF GPS #${photoIndex}] Additional GPS point:`, exif.lat, exif.lng, '(primary already set)');
                        }
                    }
                }

                // === Burst Detection: check time difference with previous photo ===
                if (!this._burstDetected && this._exifData.length >= 2 && exif.date) {
                    const prev = this._exifData[this._exifData.length - 2];
                    if (prev.date) {
                        try {
                            const curParts = exif.date.split(' ');
                            const prevParts = prev.date.split(' ');
                            const curTime = new Date(curParts[0].replace(/:/g, '-') + 'T' + curParts[1]);
                            const prevTime = new Date(prevParts[0].replace(/:/g, '-') + 'T' + prevParts[1]);
                            const diffSec = Math.abs(curTime - prevTime) / 1000;
                            if (diffSec <= 30) {
                                this._burstDetected = true;
                                toastParts.push('📸 連続撮影を検出');
                                console.log(`[Burst] Photos ${photoIndex - 1} & ${photoIndex}: ${diffSec}s apart`);
                            }
                        } catch (e) { /* ignore */ }
                    }
                }

                // Show toast
                if (toastParts.length > 0) {
                    this.exifToast = toastParts.join(' と ') + ' を写真から自動検出！';
                    this.exifToastVisible = true;
                    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
                    setTimeout(() => { this.exifToastVisible = false; }, 4000);
                }
            } catch (e) {
                console.warn('[EXIF] Failed to read:', e);
            }
        },

        /** Apply EXIF GPS to map and state */
        _applyExifGps(lat, lng) {
            this.lat = lat.toFixed(6);
            this.lng = lng.toFixed(6);
            this.locationSource = 'exif';
            this.reverseGeocode(this.lat, this.lng);
            const applyToMap = () => {
                if (this.map && this.marker) {
                    this.map.flyTo([lat, lng], 16);
                    this.marker.setLatLng([lat, lng]);
                } else {
                    setTimeout(applyToMap, 500);
                }
            };
            applyToMap();
        },

        /** User chose: use photo (EXIF) location */
        usePhotoLocation() {
            this.gpsConflict = false;
            // Already applied by default, just confirm
            if (navigator.vibrate) navigator.vibrate(30);
        },

        /** User chose: use device (current) location */
        useDeviceLocation() {
            if (this.gpsConflictData) {
                this.lat = this.gpsConflictData.deviceLat.toFixed(6);
                this.lng = this.gpsConflictData.deviceLng.toFixed(6);
                this.locationSource = 'gps';
                this.reverseGeocode(this.lat, this.lng);
                if (this.map && this.marker) {
                    this.map.flyTo([this.lat, this.lng], 16);
                    this.marker.setLatLng([this.lat, this.lng]);
                }
            }
            this.gpsConflict = false;
            this.gpsConflictData = null;
            if (navigator.vibrate) navigator.vibrate(30);
        },

        /** Haversine distance in meters between two lat/lng points */
        _haversine(lat1, lng1, lat2, lng2) {
            const R = 6371000;
            const toRad = d => d * Math.PI / 180;
            const dLat = toRad(lat2 - lat1);
            const dLng = toRad(lng2 - lng1);
            const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                Math.sin(dLng / 2) ** 2;
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }
    }
}

/**
 * SiteGuide — エリアガイド表示コンポーネント
 *
 * ウォーク/自転車モードで自然共生サイト等のエリアに入った際、
 * ガイドコンテンツ(POI・おすすめルート・季節情報)をパネル表示する。
 *
 * Usage:
 *   const guide = new SiteGuide(map, {
 *     onEnterSite: (siteId, guide) => {},
 *     onLeaveSite: () => {},
 *   });
 *   guide.checkPosition(lat, lng);
 */
class SiteGuide {
    constructor(map, opts = {}) {
        this.map = map;
        this.opts = opts;
        this.currentSiteId = null;
        this.guideData = null;
        this.panel = null;
        this.isOpen = false;
        this.expandedPoi = null;
        this._checking = false;
        this._lastCheck = 0;
        this._checkInterval = 10000;
        this._dismissed = false;
        this._visitHistory = this._loadVisitHistory();
        this._createPanel();
    }

    // ── Visit History (localStorage) ──

    _loadVisitHistory() {
        try {
            return JSON.parse(localStorage.getItem('sg_visits') || '{}');
        } catch { return {}; }
    }

    _saveVisitHistory() {
        try {
            localStorage.setItem('sg_visits', JSON.stringify(this._visitHistory));
        } catch {}
    }

    _getVisitCount(siteId) {
        return this._visitHistory[siteId]?.count || 0;
    }

    _recordVisit(siteId) {
        if (!this._visitHistory[siteId]) {
            this._visitHistory[siteId] = { count: 0, readPois: [], firstVisit: Date.now() };
        }
        this._visitHistory[siteId].count++;
        this._visitHistory[siteId].lastVisit = Date.now();
        this._saveVisitHistory();
    }

    _markPoiRead(siteId, poiId) {
        if (!this._visitHistory[siteId]) return;
        const read = this._visitHistory[siteId].readPois || [];
        if (!read.includes(poiId)) {
            read.push(poiId);
            this._visitHistory[siteId].readPois = read;
            this._saveVisitHistory();
        }
    }

    _isPoiRead(siteId, poiId) {
        return (this._visitHistory[siteId]?.readPois || []).includes(poiId);
    }

    _getUnreadPoiCount(siteId, pois) {
        const read = this._visitHistory[siteId]?.readPois || [];
        return (pois || []).filter(p => !read.includes(p.id)).length;
    }

    /** Check if user's position falls within a guided site */
    async checkPosition(lat, lng) {
        const now = Date.now();
        if (this._checking || now - this._lastCheck < this._checkInterval) return;
        this._checking = true;
        this._lastCheck = now;

        try {
            const resp = await fetch(`api/v2/site_guide.php?lat=${lat}&lng=${lng}`);
            const json = await resp.json();

            if (json.success && json.data && json.meta?.has_guide) {
                const siteId = json.data.site_id;
                if (siteId !== this.currentSiteId) {
                    this.currentSiteId = siteId;
                    this.guideData = json.data.guide;
                    this._dismissed = false;
                    this._recordVisit(siteId);
                    this._renderGuide();
                    this._showNotification();
                    if (this.opts.onEnterSite) {
                        this.opts.onEnterSite(siteId, this.guideData);
                    }
                }
            } else if (this.currentSiteId) {
                this.currentSiteId = null;
                this.guideData = null;
                this._hidePanel();
                if (this.opts.onLeaveSite) {
                    this.opts.onLeaveSite();
                }
            }
        } catch (e) {
            console.warn('[SiteGuide] check failed:', e);
        } finally {
            this._checking = false;
        }
    }

    /** Force load a specific site guide */
    async loadSite(siteId) {
        try {
            const resp = await fetch(`api/v2/site_guide.php?site_id=${siteId}`);
            const json = await resp.json();
            if (json.success && json.data && json.meta?.has_guide) {
                this.currentSiteId = siteId;
                this.guideData = json.data.guide;
                this._dismissed = false;
                this._recordVisit(siteId);
                this._renderGuide();
                this._showNotification();
            }
        } catch (e) {
            console.warn('[SiteGuide] load failed:', e);
        }
    }

    toggle() {
        if (this.isOpen) this._hidePanel();
        else this._showPanel();
    }

    // ── Private ──

    _createPanel() {
        this.toast = document.createElement('div');
        this.toast.className = 'site-guide-toast';
        this.toast.style.display = 'none';
        document.body.appendChild(this.toast);

        this.panel = document.createElement('div');
        this.panel.className = 'site-guide-panel';
        this.panel.style.display = 'none';
        document.body.appendChild(this.panel);
    }

    _showNotification() {
        if (this._dismissed || !this.guideData || !this.currentSiteId) return;

        const visits = this._getVisitCount(this.currentSiteId);
        const pois = this.guideData.pois || [];
        const unread = this._getUnreadPoiCount(this.currentSiteId, pois);
        const w = this.guideData.welcome || {};

        // 1st visit: full welcome toast (8s)
        // 2nd visit: shorter "おかえり" toast (4s) — only if unread POIs exist
        // 3rd+ visit: no toast at all — button only
        if (visits >= 3 && unread === 0) return;

        let title, sub, autoHideMs;

        if (visits <= 1) {
            title = w.title || 'エリアガイド';
            sub = w.subtitle || 'タップしてガイドを表示';
            autoHideMs = 8000;
        } else if (unread > 0) {
            title = w.title || 'エリアガイド';
            sub = `未読スポットが ${unread} 件あります`;
            autoHideMs = 4000;
        } else {
            title = 'おかえりなさい';
            sub = `${pois.length} スポットすべて閲覧済み`;
            autoHideMs = 3000;
        }

        this.toast.innerHTML = `
            <div class="sgt-inner" data-action="open-panel">
                <div class="sgt-icon"><i data-lucide="map-pin" style="width:18px;height:18px;color:#10b981;"></i></div>
                <div class="sgt-text">
                    <div class="sgt-title">${this._esc(title)}</div>
                    <div class="sgt-sub">${this._esc(sub)}</div>
                </div>
                <div class="sgt-chevron"><i data-lucide="chevron-right" style="width:16px;height:16px;opacity:0.4;"></i></div>
            </div>
        `;
        this.toast.querySelector('[data-action="open-panel"]').addEventListener('click', () => this._showPanel());
        this.toast.style.display = 'block';
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [this.toast] });

        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            if (!this.isOpen) this.toast.style.display = 'none';
        }, autoHideMs);
    }

    _showPanel() {
        this.toast.style.display = 'none';
        this.panel.style.display = 'flex';
        this.isOpen = true;
        requestAnimationFrame(() => this.panel.classList.add('open'));
    }

    _hidePanel() {
        this.panel.classList.remove('open');
        this.isOpen = false;
        setTimeout(() => { this.panel.style.display = 'none'; }, 300);
    }

    _renderGuide() {
        const g = this.guideData;
        if (!g) return;

        const siteId = this.currentSiteId;
        const visits = this._getVisitCount(siteId);
        const season = this._getCurrentSeason();
        const seasonData = g.seasonal_highlights?.[season];

        // For repeat visitors: skip welcome, go straight to content
        const showWelcome = visits <= 1;

        let html = `
        <div class="sgp-header">
            <button class="sgp-close" data-action="close-panel">
                <i data-lucide="x" style="width:20px;height:20px;"></i>
            </button>
            <div class="sgp-title-area">
                <h2 class="sgp-title">${this._esc(g.welcome?.title || 'エリアガイド')}</h2>
                <p class="sgp-subtitle">${this._esc(g.welcome?.subtitle || '')}</p>
            </div>
        </div>
        <div class="sgp-scroll">
            ${showWelcome ? `
            <!-- Welcome (初回のみ) -->
            <div class="sgp-section sgp-welcome">
                <p>${this._esc(g.welcome?.message || '')}</p>
            </div>

            <!-- Highlights (初回のみ) -->
            ${g.highlights ? `
            <div class="sgp-section">
                <h3 class="sgp-section-title"><i data-lucide="award" style="width:14px;height:14px;"></i> ハイライト</h3>
                <div class="sgp-highlights">
                    ${g.highlights.map(h => `<div class="sgp-highlight-item">${this._esc(h)}</div>`).join('')}
                </div>
            </div>` : ''}
            ` : ''}

            <!-- Season (常に表示 — 季節は変わるから) -->
            ${seasonData ? `
            <div class="sgp-section sgp-season">
                <h3 class="sgp-section-title"><i data-lucide="sun" style="width:14px;height:14px;"></i> 今の季節（${this._esc(seasonData.months)}）</h3>
                <p class="sgp-season-desc">${this._esc(seasonData.description)}</p>
            </div>` : ''}

            <!-- Walking Routes (初回のみ) -->
            ${showWelcome && g.walking_routes?.length ? `
            <div class="sgp-section">
                <h3 class="sgp-section-title"><i data-lucide="route" style="width:14px;height:14px;"></i> おすすめルート</h3>
                <div class="sgp-routes">
                    ${g.walking_routes.map(r => `
                    <div class="sgp-route-card">
                        <div class="sgp-route-name">${this._esc(r.name)}</div>
                        <div class="sgp-route-meta">
                            <span>約${r.duration_min}分</span>
                            <span>${r.distance_m}m</span>
                            <span class="sgp-route-diff">${this._esc(r.difficulty)}</span>
                        </div>
                        <p class="sgp-route-desc">${this._esc(r.description)}</p>
                    </div>`).join('')}
                </div>
            </div>` : ''}

            <!-- POIs (常に表示 — 既読/未読の区別つき) -->
            <div class="sgp-section">
                <h3 class="sgp-section-title"><i data-lucide="map-pin" style="width:14px;height:14px;"></i> スポット一覧</h3>
                <div class="sgp-pois">
                    ${(g.pois || []).map(poi => this._renderPoi(poi, seasonData, siteId)).join('')}
                </div>
            </div>

            <!-- Nature Positive Story (初回のみ) -->
            ${showWelcome && g.nature_positive_story ? `
            <div class="sgp-section sgp-story">
                <h3 class="sgp-section-title"><i data-lucide="leaf" style="width:14px;height:14px;"></i> ${this._esc(g.nature_positive_story.title)}</h3>
                <div class="sgp-story-body">${this._nl2p(g.nature_positive_story.body)}</div>
            </div>` : ''}

            <!-- Practical Info (常に表示) -->
            ${g.practical_info ? `
            <div class="sgp-section sgp-info">
                <h3 class="sgp-section-title"><i data-lucide="info" style="width:14px;height:14px;"></i> ご案内</h3>
                ${g.practical_info.website ? `<a href="${this._esc(g.practical_info.website)}" target="_blank" rel="noopener" class="sgp-link">公式サイト</a>` : ''}
                ${g.practical_info.instagram ? `<div class="sgp-info-row">Instagram: ${this._esc(g.practical_info.instagram)}</div>` : ''}
                ${g.practical_info.notes?.length ? `
                <ul class="sgp-notes">
                    ${g.practical_info.notes.map(n => `<li>${this._esc(n)}</li>`).join('')}
                </ul>` : ''}
            </div>` : ''}

            <div style="height:32px;"></div>
        </div>`;

        this.panel.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [this.panel] });

        // Close button
        const closeBtn = this.panel.querySelector('[data-action="close-panel"]');
        if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); this._hidePanel(); });

        // Attach expand listeners + mark POI as read on expand
        this.panel.querySelectorAll('.sgp-poi-card').forEach(card => {
            card.addEventListener('click', () => {
                const isExpanded = card.classList.contains('expanded');
                this.panel.querySelectorAll('.sgp-poi-card.expanded').forEach(c => c.classList.remove('expanded'));
                if (!isExpanded) {
                    card.classList.add('expanded');
                    const poiId = card.dataset.poiId;
                    if (poiId && siteId) {
                        this._markPoiRead(siteId, poiId);
                        card.classList.remove('sgp-poi-unread');
                        card.classList.add('sgp-poi-read');
                    }
                }
            });
        });
    }

    _renderPoi(poi, seasonData, siteId) {
        const isRecommended = seasonData?.recommended_pois?.includes(poi.id);
        const isRead = this._isPoiRead(siteId, poi.id);
        const categoryIcons = {
            nature: '🌿', dining: '🍽️', farm: '🌱', education: '📚',
            technology: '⚡', facility: '🏢', event: '✨'
        };
        const catEmoji = categoryIcons[poi.category] || '📍';
        const readClass = isRead ? 'sgp-poi-read' : 'sgp-poi-unread';

        return `
        <div class="sgp-poi-card ${readClass}" data-poi-id="${this._esc(poi.id)}">
            <div class="sgp-poi-header">
                <span class="sgp-poi-emoji">${catEmoji}</span>
                <div class="sgp-poi-titles">
                    <div class="sgp-poi-name">
                        ${this._esc(poi.name)}
                        ${isRecommended ? '<span class="sgp-poi-badge">今が旬</span>' : ''}
                        ${!isRead ? '<span class="sgp-poi-badge sgp-poi-new">NEW</span>' : ''}
                    </div>
                    <div class="sgp-poi-short">${this._esc(poi.short_description)}</div>
                </div>
                <i data-lucide="chevron-down" class="sgp-poi-chevron" style="width:16px;height:16px;flex-shrink:0;opacity:0.3;"></i>
            </div>
            <div class="sgp-poi-detail">
                <div class="sgp-poi-long">${this._nl2p(poi.long_description || '')}</div>
                ${poi.tips?.length ? `
                <div class="sgp-poi-tips">
                    <strong>💡 ヒント</strong>
                    ${poi.tips.map(t => `<div class="sgp-tip">${this._esc(t)}</div>`).join('')}
                </div>` : ''}
                ${poi.best_season ? `<div class="sgp-poi-season">🗓️ ベストシーズン: ${this._esc(poi.best_season)}</div>` : ''}
                ${poi.trivia ? `<div class="sgp-poi-trivia">💎 ${this._esc(poi.trivia)}</div>` : ''}
            </div>
        </div>`;
    }

    _getCurrentSeason() {
        const m = new Date().getMonth() + 1;
        if (m >= 3 && m <= 5) return 'spring';
        if (m >= 6 && m <= 8) return 'summer';
        if (m >= 9 && m <= 11) return 'autumn';
        return 'winter';
    }

    _esc(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    _nl2p(str) {
        if (!str) return '';
        return str.split('\n\n').map(p => `<p>${this._esc(p)}</p>`).join('');
    }
}

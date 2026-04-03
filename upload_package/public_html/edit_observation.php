<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/CSRF.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/ObservationMeta.php';

Auth::init();
$currentUser = Auth::user();
$csrfToken = CSRF::generate();

$id = trim((string)($_GET['id'] ?? ''));
$obs = DataStore::findById('observations', $id);

if (!$obs) {
    http_response_code(404);
    echo 'Observation not found';
    exit;
}

if (!$currentUser) {
    header('Location: /login.php?redirect=' . urlencode('/edit_observation.php?id=' . $id));
    exit;
}

$canEdit = ObservationMeta::canEditObservation($obs, $currentUser);
$canModerate = ObservationMeta::canDirectlyModerateMetadata($currentUser);
$proposalMode = !$canEdit;
$biomeMeta = is_array($obs['biome_meta'] ?? null) ? $obs['biome_meta'] : [];
$biomeWasAutoSelected = !empty($biomeMeta['auto_selected']);
$biomeAutoReason = trim((string)($biomeMeta['reason'] ?? ''));

$meta_title = $proposalMode ? '構造化情報を提案' : '観察を編集';
$meta_description = '観察の日時・場所・環境・ライフステージなどを更新します。';
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <link href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.css" rel="stylesheet" />
    <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.js"></script>
</head>
<body class="font-body min-h-screen" style="background:var(--md-surface);color:var(--md-on-surface);">
<?php include __DIR__ . '/components/nav.php'; ?>

<main class="max-w-3xl mx-auto px-4 sm:px-6 pt-24 pb-24" x-data="observationEditor()">
    <div class="mb-6">
        <a href="/observation_detail.php?id=<?= urlencode($id) ?>" class="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-primary-dark">
            <i data-lucide="arrow-left" class="w-4 h-4"></i>
            観察詳細に戻る
        </a>
    </div>

    <section class="p-6 sm:p-8" style="border-radius:var(--shape-xl);border:1px solid var(--md-outline-variant);background:var(--md-surface-container);box-shadow:var(--elev-1);">
        <div class="flex items-start justify-between gap-4">
            <div>
                <p class="text-[11px] font-black uppercase tracking-[0.18em] text-faint"><?= $proposalMode ? 'COMMUNITY METADATA' : 'EDIT OBSERVATION' ?></p>
                <h1 class="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-text">
                    <?= $proposalMode ? '構造化情報を提案する' : '観察データを編集する' ?>
                </h1>
                <p class="mt-3 text-sm leading-relaxed text-muted">
                    <?= $proposalMode
                        ? '原本の写真や本文は変えずに、環境・野生性・施設文脈・ライフステージを提案できます。信頼ユーザーは直接更新になります。'
                        : '投稿者本人は、観察日時・場所・環境・個体数・由来・メモをあとから直せます。保存後は同定と AI ヒントも再評価されます。'; ?>
                </p>
            </div>
            <span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold <?= $proposalMode ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200' ?>">
                <?= $proposalMode ? ($canModerate ? '信頼ユーザー補正' : '提案モード') : '投稿者編集' ?>
            </span>
        </div>

        <div class="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <?php foreach (array_slice($obs['photos'] ?? [], 0, 3) as $photo): ?>
                <img src="<?= htmlspecialchars($photo) ?>" alt="観察写真" class="aspect-square rounded-2xl object-cover" style="border:1px solid var(--md-outline-variant);background:var(--md-surface-container-low);">
            <?php endforeach; ?>
        </div>

        <div class="mt-6 rounded-2xl border <?= $biomeWasAutoSelected ? 'border-primary/20 bg-primary/5' : 'border-border bg-base' ?> px-4 py-3">
            <p class="text-sm font-bold text-text flex items-center gap-2">
                <i data-lucide="<?= $biomeWasAutoSelected ? 'sparkles' : 'pencil' ?>" class="w-4 h-4 <?= $biomeWasAutoSelected ? 'text-primary' : 'text-muted' ?>"></i>
                <?= $biomeWasAutoSelected ? 'この環境は投稿時に自動選択されました' : 'この環境や状態はあとから直せます' ?>
            </p>
            <p class="text-[11px] text-muted mt-1.5 leading-relaxed">
                <?= $biomeWasAutoSelected && $biomeAutoReason !== ''
                    ? htmlspecialchars($biomeAutoReason) . '。違っていたらここで直せますし、必要ならほかの人の提案も受け取れます。'
                    : '違っていたらここで直せます。投稿者でなくても、環境や状態の提案を重ねて記録を育てられます。'; ?>
            </p>
        </div>

        <form class="mt-8 space-y-6" @submit.prevent="submit">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label class="block">
                    <span class="block text-[10px] font-black uppercase tracking-[0.18em] text-faint mb-2">観察日時</span>
                    <input x-model="form.observed_at" type="datetime-local" class="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);">
                </label>
                <label class="block">
                    <span class="block text-[10px] font-black uppercase tracking-[0.18em] text-faint mb-2">ライフステージ</span>
                    <select x-model="form.life_stage" class="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);">
                        <option value="unknown">不明</option>
                        <option value="adult">成体</option>
                        <option value="juvenile">幼体</option>
                        <option value="egg">卵・種子</option>
                        <option value="trace">痕跡</option>
                        <option value="larva">幼生</option>
                        <option value="pupa">サナギ</option>
                        <option value="exuviae">抜け殻</option>
                    </select>
                </label>
                <div class="sm:col-span-2">
                    <span class="block text-[10px] font-black uppercase tracking-[0.18em] text-faint mb-2">場所</span>
                    <div id="edit-map" class="w-full h-64 rounded-2xl overflow-hidden mb-2" style="border:1px solid var(--md-outline-variant);"></div>
                    <div class="flex items-center gap-3">
                        <p class="text-xs text-muted flex-1" x-text="'📍 ' + Number(form.lat).toFixed(6) + ', ' + Number(form.lng).toFixed(6)"></p>
                        <button type="button" @click="getCurrentLocation()" class="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-[11px] font-bold text-text hover:border-primary/30 hover:text-primary transition">
                            <i data-lucide="locate" class="w-3 h-3"></i>
                            現在地
                        </button>
                    </div>
                    <p class="text-[11px] text-muted mt-1">地図をタップ or マーカーをドラッグして位置を調整</p>
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label class="block">
                    <span class="block text-[10px] font-black uppercase tracking-[0.18em] text-faint mb-2">環境</span>
                    <select x-model="form.biome" class="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);">
                        <option value="unknown">不明 / わからない</option>
                        <option value="forest">森林</option>
                        <option value="grassland">草地・河川敷</option>
                        <option value="wetland">湿地・水辺</option>
                        <option value="coastal">海岸・干潟</option>
                        <option value="urban">都市・公園</option>
                        <option value="farmland">農地・里山</option>
                    </select>
                </label>
                <label class="block">
                    <span class="block text-[10px] font-black uppercase tracking-[0.18em] text-faint mb-2">個体数</span>
                    <select x-model="form.individual_count" class="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);">
                        <option value="">未入力</option>
                        <option value="1">1</option>
                        <option value="3">2〜5</option>
                        <option value="8">6〜10</option>
                        <option value="30">11〜50</option>
                        <option value="51">50+</option>
                    </select>
                </label>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label class="block">
                    <span class="block text-[10px] font-black uppercase tracking-[0.18em] text-faint mb-2">状態</span>
                    <select x-model="form.cultivation" class="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);">
                        <option value="wild">野生</option>
                        <option value="cultivated">植栽・飼育</option>
                    </select>
                </label>
                <label class="block">
                    <span class="block text-[10px] font-black uppercase tracking-[0.18em] text-faint mb-2">個体の由来</span>
                    <select x-model="form.organism_origin" class="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);">
                        <option value="wild">野生</option>
                        <option value="cultivated">栽培個体</option>
                        <option value="captive">飼育個体</option>
                        <option value="released">放された個体</option>
                        <option value="escaped">逸出個体</option>
                        <option value="naturalized">野外定着</option>
                        <option value="uncertain">判断保留</option>
                    </select>
                </label>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label class="block">
                    <span class="block text-[10px] font-black uppercase tracking-[0.18em] text-faint mb-2">施設文脈</span>
                    <select x-model="form.managed_context_type" class="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);">
                        <option value="">施設なし</option>
                        <option value="botanical_garden">植物園</option>
                        <option value="zoo">動物園</option>
                        <option value="aquarium">水族館</option>
                        <option value="aviary">花鳥園・鳥類園</option>
                        <option value="conservation_center">保全施設・研究飼育</option>
                        <option value="park_planting">公園植栽</option>
                        <option value="school_biotope">学校ビオトープ</option>
                        <option value="private_collection">私設コレクション</option>
                        <option value="other">その他</option>
                    </select>
                </label>
                <label class="block">
                    <span class="block text-[10px] font-black uppercase tracking-[0.18em] text-faint mb-2">施設名</span>
                    <input x-model="form.managed_site_name" type="text" class="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);">
                </label>
            </div>

            <label class="block">
                <span class="block text-[10px] font-black uppercase tracking-[0.18em] text-faint mb-2">施設補足</span>
                <textarea x-model="form.managed_context_note" class="w-full h-24 rounded-2xl border border-border bg-base px-4 py-3 text-sm text-text focus:outline-none focus:border-primary"></textarea>
            </label>

            <label class="block">
                <span class="block text-[10px] font-black uppercase tracking-[0.18em] text-faint mb-2"><?= $proposalMode ? '提案メモ' : '編集メモ' ?></span>
                <textarea x-model="form.edit_note" class="w-full h-24 rounded-2xl border border-border bg-base px-4 py-3 text-sm text-text focus:outline-none focus:border-primary" placeholder="<?= $proposalMode ? 'なぜこの提案をしたかを一言' : 'あとから見返してわかるように一言' ?>"></textarea>
            </label>

            <?php if (!$proposalMode): ?>
                <label class="block">
                    <span class="block text-[10px] font-black uppercase tracking-[0.18em] text-faint mb-2">観察メモ</span>
                    <textarea x-model="form.note" class="w-full h-32 rounded-2xl border border-border bg-base px-4 py-3 text-sm text-text focus:outline-none focus:border-primary"></textarea>
                </label>
            <?php endif; ?>

            <div class="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                <p class="text-sm font-bold text-text"><?= $proposalMode ? '保存後の動き' : '更新後の動き' ?></p>
                <ul class="mt-2 space-y-1 text-xs leading-relaxed text-muted">
                    <li>・変更は履歴に残ります</li>
                    <li>・同定の合意は自動で再計算されます</li>
                    <li>・AIヒントも必要なら再評価されます</li>
                </ul>
            </div>

            <div class="flex flex-wrap items-center gap-3">
                <button type="submit" class="inline-flex min-h-[48px] items-center justify-center rounded-full bg-primary px-6 text-sm font-bold text-white shadow-sm shadow-primary/20 transition hover:bg-primary-dark disabled:opacity-50" :disabled="saving">
                    <span x-show="!saving"><?= $proposalMode ? '提案を送る' : '変更を保存する' ?></span>
                    <span x-show="saving">保存中...</span>
                </button>
                <a href="/observation_detail.php?id=<?= urlencode($id) ?>" class="inline-flex min-h-[48px] items-center justify-center rounded-full px-6 text-sm font-bold" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);">戻る</a>
                <p class="text-xs text-muted" x-text="message"></p>
            </div>
        </form>
    </section>
</main>

<script nonce="<?= CspNonce::attr() ?>">
function observationEditor() {
    return {
        saving: false,
        message: '',
        proposalMode: <?= $proposalMode ? 'true' : 'false' ?>,
        _map: null,
        _marker: null,
        init() {
            this.$nextTick(() => this._initMap());
        },
        _initMap() {
            const lat = parseFloat(this.form.lat) || 35.68;
            const lng = parseFloat(this.form.lng) || 139.76;

            // Fix Leaflet default marker icon
            delete L.Icon.Default.prototype._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                iconUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png',
                shadowUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png',
            });

            this._map = L.map('edit-map').setView([lat, lng], 15);
            L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>',
                maxZoom: 18,
            }).addTo(this._map);

            this._marker = L.marker([lat, lng], { draggable: true }).addTo(this._map);

            this._marker.on('dragend', () => {
                const pos = this._marker.getLatLng();
                this.form.lat = pos.lat.toFixed(6);
                this.form.lng = pos.lng.toFixed(6);
            });

            this._map.on('click', (e) => {
                this._marker.setLatLng(e.latlng);
                this.form.lat = e.latlng.lat.toFixed(6);
                this.form.lng = e.latlng.lng.toFixed(6);
            });

            setTimeout(() => this._map.invalidateSize(), 200);
        },
        getCurrentLocation() {
            if (!('geolocation' in navigator)) return;
            navigator.geolocation.getCurrentPosition((pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                this.form.lat = lat.toFixed(6);
                this.form.lng = lng.toFixed(6);
                if (this._map && this._marker) {
                    this._marker.setLatLng([lat, lng]);
                    this._map.flyTo([lat, lng], 16);
                }
            }, () => {
                this.message = '位置情報の取得に失敗しました';
            }, { enableHighAccuracy: true, timeout: 10000 });
        },
        form: <?= json_encode([
            'observation_id' => $id,
            'observed_at' => !empty($obs['observed_at']) ? date('Y-m-d\TH:i', strtotime((string)$obs['observed_at'])) : '',
            'lat' => $obs['lat'] ?? '',
            'lng' => $obs['lng'] ?? '',
            'biome' => $obs['biome'] ?? 'unknown',
            'life_stage' => $obs['life_stage'] ?? 'unknown',
            'individual_count' => $obs['individual_count'] ?? '',
            'cultivation' => $obs['cultivation'] ?? 'wild',
            'organism_origin' => $obs['organism_origin'] ?? (($obs['cultivation'] ?? 'wild') === 'cultivated' ? 'cultivated' : 'wild'),
            'managed_context_type' => $obs['managed_context']['type'] ?? '',
            'managed_site_name' => $obs['managed_context']['site_name'] ?? '',
            'managed_context_note' => $obs['managed_context']['note'] ?? '',
            'note' => $obs['note'] ?? '',
            'edit_note' => '',
        ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) ?>,
        async submit() {
            this.saving = true;
            this.message = '';
            try {
                const endpoint = this.proposalMode ? '/api/propose_observation_metadata.php' : '/api/update_observation.php';
                const res = await fetch(endpoint + '?csrf_token=<?= urlencode($csrfToken) ?>', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Csrf-Token': '<?= $csrfToken ?>'
                    },
                    body: JSON.stringify(this.form)
                });
                const data = await res.json();
                if (!data.success) {
                    throw new Error(data.message || '保存に失敗しました');
                }
                this.message = data.message || '保存しました';
                setTimeout(() => {
                    window.location.href = '/observation_detail.php?id=<?= urlencode($id) ?>';
                }, 700);
            } catch (error) {
                this.message = error.message || '保存に失敗しました';
            } finally {
                this.saving = false;
            }
        }
    };
}
</script>
</body>
</html>

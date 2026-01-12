<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/CSRF.php';

// Guest Access Allowed
Auth::init(); 
// if (!Auth::isLoggedIn()) { header('Location: login.php'); exit; }
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php 
    $meta_title = "投稿する";
    include __DIR__ . '/components/meta.php'; 
    ?>
    <!-- EXIF.js for client-side extraction -->
    <script src="https://cdn.jsdelivr.net/npm/exif-js"></script>
    <!-- MapLibre GL JS -->
    <script src="https://unpkg.com/maplibre-gl@3.x.x/dist/maplibre-gl.js"></script>
    <link href="https://unpkg.com/maplibre-gl@3.x.x/dist/maplibre-gl.css" rel="stylesheet" />
    <!-- Offline Manager -->
    <script src="js/ToastManager.js"></script>
    <script src="js/OfflineManager.js"></script>
</head>
<body class="js-loading bg-[var(--color-bg-base)] text-[var(--color-text)] font-body">
    
    <script>document.body.classList.remove('js-loading');</script>

    <div x-data="uploader()" class="w-full md:max-w-md mx-auto relative min-h-screen">
        
        <!-- Immersive Header -->
        <header class="fixed top-0 left-0 w-full md:max-w-md md:left-[50%] md:translate-x-[-50%] h-14 flex items-center justify-between px-4 bg-[var(--color-bg-base)]/90 backdrop-blur-xl z-50 border-b border-white/5">
            <a href="index.php" class="p-2 -ml-2 text-gray-400 hover:text-white transition">
                <i data-lucide="x" class="w-6 h-6"></i>
            </a>
            <h1 class="text-sm font-black tracking-widest uppercase">New Observation</h1>
            <div class="w-10"></div> <!-- Spacer for center alignment -->
        </header>

        <main class="pt-20 pb-32 px-4">
            
            <form @submit.prevent="submit" class="space-y-8">
                <!-- Photo Upload Area -->
                <div class="relative group">
                    <input type="file" multiple accept="image/*" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" @change="handleFiles">
                    <div class="border-2 border-dashed border-white/20 rounded-3xl p-8 text-center group-hover:border-green-500/50 transition bg-white/5">
                        <div x-show="photos.length === 0">
                            <i data-lucide="camera" class="w-10 h-10 mx-auto mb-4 text-[var(--color-primary)]"></i>
                            <p class="text-sm font-bold">写真をタップして追加</p>
                        </div>
                        
                        <!-- Preview Grid -->
                        <div class="grid grid-cols-2 gap-3" x-show="photos.length > 0">
                            <template x-for="(photo, index) in photos" :key="index">
                                <div class="relative aspect-square rounded-2xl overflow-hidden bg-[var(--color-bg-surface)] shadow-lg">
                                    <img :src="photo.preview" class="w-full h-full object-cover">
                                    <button @click.prevent="removePhoto(index)" class="absolute top-2 right-2 p-1 bg-black/50 rounded-full hover:bg-red-500 transition z-30">
                                        <i data-lucide="x" class="w-3 h-3"></i>
                                    </button>
                                </div>
                            </template>
                            <!-- Add More Button in Grid -->
                            <div class="aspect-square border-2 border-dashed border-white/10 rounded-2xl flex items-center justify-center text-gray-500 bg-white/5">
                                <i data-lucide="plus" class="w-6 h-6"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Form Fields (Slide In) -->
                <div class="space-y-6" x-show="photos.length > 0" x-transition>
                    
                    <!-- Date -->
                    <div>
                        <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 px-2">日時</label>
                        <input type="datetime-local" x-model="observed_at" class="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-green-500 transition text-white font-bold">
                    </div>

                    <!-- Location -->
                    <div>
                        <div class="flex justify-between items-center mb-2 px-2">
                            <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest">場所</label>
                            <button type="button" @click="loadHistory()" class="text-[10px] font-bold text-[var(--color-primary)] flex items-center gap-1">
                                <i data-lucide="history" class="w-3 h-3"></i>
                                前回と同じ
                            </button>
                        </div>
                        <div id="map" class="w-full h-48 rounded-2xl mb-3 bg-white/5 border border-white/10 overflow-hidden relative z-0"></div>
                        <p class="text-[10px] text-gray-500 px-2 flex items-center gap-1">
                            <i data-lucide="map-pin" class="w-3 h-3"></i>
                            地図をタップまたはドラッグして微調整
                        </p>
                    </div>

                    <!-- Status -->
                    <div>
                        <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 px-2">状態</label>
                        <div class="grid grid-cols-2 gap-2">
                            <label class="cursor-pointer">
                                <input type="radio" value="wild" x-model="cultivation" class="hidden peer">
                                <div class="text-center py-3 rounded-2xl border border-white/10 bg-white/5 peer-checked:bg-green-500 peer-checked:text-black peer-checked:border-green-500 transition text-xs font-bold text-gray-400">
                                    <i data-lucide="leaf" class="w-4 h-4 mx-auto mb-1"></i>
                                    野生
                                </div>
                            </label>
                            <label class="cursor-pointer">
                                <input type="radio" value="cultivated" x-model="cultivation" class="hidden peer">
                                <div class="text-center py-3 rounded-2xl border border-white/10 bg-white/5 peer-checked:bg-yellow-500 peer-checked:text-black peer-checked:border-yellow-500 transition text-xs font-bold text-gray-400">
                                    <i data-lucide="flower" class="w-4 h-4 mx-auto mb-1"></i>
                                    植栽
                                </div>
                            </label>
                        </div>
                    </div>

                    <!-- Life Stage -->
                    <div>
                        <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 px-2">ライフステージ</label>
                        <div class="flex flex-wrap gap-2">
                            <template x-for="stage in [
                                {id: 'adult', label: '成体', icon: 'bug'},
                                {id: 'larva', label: '幼生', icon: 'nut'},
                                {id: 'pupa', label: 'サナギ', icon: 'package'},
                                {id: 'egg', label: '卵', icon: 'circle'},
                                {id: 'exuviae', label: '痕跡', icon: 'ghost'}
                            ]">
                                <label class="cursor-pointer">
                                    <input type="radio" :value="stage.id" x-model="life_stage" class="hidden peer">
                                    <div class="px-4 py-2 rounded-xl border border-white/10 bg-white/5 peer-checked:bg-[var(--color-primary)] peer-checked:text-black peer-checked:border-[var(--color-primary)] transition text-xs font-bold text-gray-400 flex items-center gap-1">
                                        <i :data-lucide="stage.icon" class="w-3 h-3"></i>
                                        <span x-text="stage.label"></span>
                                    </div>
                                </label>
                            </template>
                            <label class="cursor-pointer">
                                <input type="radio" value="unknown" x-model="life_stage" class="hidden peer">
                                <div class="px-4 py-2 rounded-xl border border-white/10 bg-white/5 peer-checked:bg-gray-500 peer-checked:text-white peer-checked:border-gray-500 transition text-xs font-bold text-gray-400">
                                    不明
                                </div>
                            </label>
                        </div>
                    </div>

                    <!-- Taxon / Name (Optional) -->
                    <div>
                        <div class="flex justify-between items-center mb-2 px-2">
                             <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest">名前 (わかる場合)</label>
                             <button type="button" @click="$dispatch('open-navigator')" class="text-xs font-bold text-[var(--color-primary)] flex items-center gap-1 bg-[var(--color-primary)]/10 px-3 py-1.5 rounded-full hover:bg-[var(--color-primary)]/20 transition">
                                 <i data-lucide="compass" class="w-3 h-3"></i>
                                 ナビで調べる
                             </button>
                        </div>
                        <div class="relative">
                            <input type="text" x-model="taxon_name" placeholder="種名・名称を入力..." class="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-green-500 transition text-white font-bold pl-11">
                            <div class="absolute left-4 top-3.5 text-gray-500">
                                <i data-lucide="search" class="w-4 h-4"></i>
                            </div>
                        </div>
                    </div>

                    <!-- Note -->
                    <div>
                        <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 px-2">メモ</label>
                        <textarea x-model="note" placeholder="気づいたことを記録..." class="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 h-24 focus:outline-none focus:border-green-500 transition text-white placeholder-gray-600 font-medium"></textarea>
                    </div>
                </div>

                <!-- Navigator Component -->
                <div @navigator-result.window="
                    taxon_name = $event.detail.query; 
                    if($event.detail.life_stage !== 'unknown') life_stage = $event.detail.life_stage;
                ">
                    <?php include __DIR__ . '/components/navigator.php'; ?>
                </div>
            </form>
        </main>

        <!-- Fixed Bottom Action Bar -->
        <div class="fixed bottom-0 left-0 w-full md:max-w-md md:left-[50%] md:translate-x-[-50%] p-4 bg-gradient-to-t from-[var(--color-bg-base)] via-[var(--color-bg-base)] to-transparent z-40 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <button @click="submit" :disabled="submitting || photos.length === 0" 
                    class="w-full py-4 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-emerald-400 text-[#05070a] font-black shadow-[0_10px_40px_-10px_rgba(16,185,129,0.5)] flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:shadow-none active:scale-95">
                <i data-lucide="send" x-show="!submitting" class="w-5 h-5"></i>
                <span x-show="!submitting">投稿する</span>
                <span x-show="submitting">送信中...</span>
            </button>
        </div>

        <!-- Fullscreen Loading Overlay (Previously defined, keeping logic) -->
        <div x-show="submitting" x-transition.opacity 
             class="fixed inset-0 z-[100] bg-[var(--color-bg-base)]/90 backdrop-blur-xl flex flex-col items-center justify-center">
            
            <div x-show="!success" class="text-center w-full max-w-sm px-6">
                <div class="relative w-24 h-24 mx-auto mb-8">
                    <div class="absolute inset-0 border-4 border-white/10 rounded-full"></div>
                    <div class="absolute inset-0 border-4 border-[var(--color-primary)] rounded-full border-t-transparent animate-spin"></div>
                </div>
                <!-- Progress Bar logic same as before -->
                 <div class="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div class="h-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] transition-all duration-300" :style="'width: ' + progress + '%'"></div>
                </div>
            </div>

            <div x-show="success" class="text-center" x-transition:enter="transition ease-out duration-500" x-transition:enter-start="opacity-0 scale-90" x-transition:enter-end="opacity-100 scale-100">
                <div class="w-32 h-32 mx-auto mb-6 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(34,197,94,0.5)]">
                    <i data-lucide="check" class="w-16 h-16 text-black animate-[bounce_1s_infinite]"></i>
                </div>
                <h3 class="text-3xl font-black mb-2">完了!</h3>
            </div>
        </div>

        <!-- Re-including Login Modal Logic (same as before) -->
        <!-- Re-including Login Modal Logic (same as before) -->
        <!-- Post page handles its own auth flow, removed generic onboarding modal --> 
        <!-- Actually onboarding is for home. We need the specific login modal logic here or assume Auth wrapper. 
             The previous post.php had inline login modal. I will re-inject it or better yet, make it a component?
             For now, I'll keep the inline logic for simplicity but condensed. -->
        
        <div x-show="showLoginModal" style="display: none;" 
             class="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
             x-transition.opacity>
             <!-- Login Modal Content (same as previous) -->
             <div class="bg-[var(--color-bg-surface)] border border-white/10 rounded-3xl w-full max-w-sm overflow-hidden" @click.away="showLoginModal = false">
                <div class="p-6 text-center">
                    <h3 class="text-xl font-bold mb-6">ログインして保存</h3>
                    <!-- Demo User Selection -->
                    <div class="space-y-2 mb-6 text-left">
                        <template x-for="user in demoUsers" :key="user.id">
                            <label class="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer" :class="loginUserId === user.id ? 'border-green-500 bg-green-500/10' : ''">
                                <input type="radio" name="login_user" :value="user.id" x-model="loginUserId" class="accent-green-500">
                                <span x-text="user.name" class="font-bold text-sm"></span>
                            </label>
                        </template>
                    </div>
                    <button type="button" @click="login()" class="w-full py-3 rounded-xl font-bold bg-green-500 text-black">ログイン</button>
                </div>
            </div>
        </div>

    </div>

    <script>
        // Copying the script logic from previous file but ensuring it matches new DOM
        function uploader() {
            return {
                photos: [],
                observed_at: '',
                lat: '34.7108',
                lng: '137.7261',
                cultivation: 'wild',
                life_stage: 'unknown',
                taxon_name: '',
                note: '',
                submitting: false,
                progress: 0,
                success: false,
                map: null,
                marker: null,
                isLoggedIn: <?php echo Auth::isLoggedIn() ? 'true' : 'false'; ?>,
                showLoginModal: false,
                loginUserId: 'user_ya_001',
                csrfToken: '<?php echo CSRF::generate(); ?>',
                demoUsers: [
                    {id: 'user_ya_001', name: '八巻 毅', rank: '認定研究者', avatar: 'https://i.pravatar.cc/300?u=yamaki'},
                ],

                async loadHistory() {
                     if (!this.isLoggedIn) { alert('履歴機能を使うにはログインが必要です'); return; }
                     try {
                        const res = await fetch('api/get_last_observation.php');
                        const json = await res.json();
                        if (json.success) {
                            const d = json.data;
                            this.lat = d.lat; this.lng = d.lng; this.cultivation = d.cultivation;
                            if (this.map && this.marker) {
                                this.map.flyTo({ center: [this.lng, this.lat], zoom: 16 });
                                this.marker.setLngLat([this.lng, this.lat]);
                            }
                        }
                     } catch(e) {}
                },

                init() {
                    // Draft Recovery
                    const draft = localStorage.getItem('draft_obs');
                    if (draft) {
                        try {
                            const d = JSON.parse(draft);
                            if (d.note) this.note = d.note;
                            if (d.cultivation) this.cultivation = d.cultivation;
                            // We don't restore lat/lng for now as it might be stale, unless very recent?
                        } catch(e){}
                    }

                    // Auto-Save Draft
                    this.$watch('note', val => this.saveDraft());
                    this.$watch('cultivation', val => this.saveDraft());

                    // Map Init
                    this.$nextTick(() => {
                        this.map = new maplibregl.Map({
                            container: 'map',
                            style: 'https://tile.openstreetmap.jp/styles/maptiler-basic-ja/style.json',
                            center: [this.lng, this.lat],
                            zoom: 13
                        });
                        this.marker = new maplibregl.Marker({ draggable: true, color: '#10b981' })
                            .setLngLat([this.lng, this.lat])
                            .addTo(this.map);
                        
                        this.marker.on('dragend', () => {
                            const l = this.marker.getLngLat(); this.lat = l.lat.toFixed(6); this.lng = l.lng.toFixed(6);
                            if(navigator.vibrate) navigator.vibrate(10);
                        });
                        this.map.on('click', (e) => {
                            this.marker.setLngLat(e.lngLat); this.lat = e.lngLat.lat.toFixed(6); this.lng = e.lngLat.lng.toFixed(6);
                            if(navigator.vibrate) navigator.vibrate(10);
                        });
                    });
                },

                saveDraft() {
                    localStorage.setItem('draft_obs', JSON.stringify({
                        note: this.note,
                        cultivation: this.cultivation,
                        timestamp: Date.now()
                    }));
                },

                handleFiles(e) {
                    if(navigator.vibrate) navigator.vibrate(50);
                    const files = Array.from(e.target.files);
                    files.forEach(file => {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            const photo = { file: file, preview: ev.target.result, size: file.size, compressed: false, blob: null };
                            this.photos.push(photo);
                            this.compressPhoto(photo);
                            
                            // EXIF Logic
                            if (this.photos.length === 1) {
                                EXIF.getData(file, () => {
                                    const d = EXIF.getTag(file, "DateTimeOriginal");
                                    if(d) {
                                        const parts = d.split(' ');
                                        const dt = parts[0].replace(/:/g, '-') + 'T' + parts[1].slice(0, 5);
                                        this.observed_at = dt;
                                    }
                                });
                            }
                        };
                        reader.readAsDataURL(file);
                    });
                },
                
                removePhoto(index) { 
                    this.photos.splice(index, 1); 
                    if(navigator.vibrate) navigator.vibrate(20);
                },
                
                async compressPhoto(photo) {
                    const img = new Image(); img.src = photo.preview;
                    await new Promise(resolve => img.onload = resolve);
                    const canvas = document.createElement('canvas');
                    let w = img.width; let h = img.height; const max=1280;
                    if(w>max||h>max){ if(w>h){h=Math.round(h*max/w);w=max;}else{w=Math.round(w*max/h);h=max;}}
                    canvas.width=w; canvas.height=h;
                    canvas.getContext('2d').drawImage(img,0,0,w,h);
                    canvas.toBlob(b=>{ photo.blob=b; photo.compressed=true; }, 'image/webp', 0.8);
                },

                async login() {
                    this.isLoggedIn = true; this.showLoginModal = false; this.submit();
                },

                async submit() {
                    if(!this.isLoggedIn) { this.showLoginModal = true; return; }
                    if(navigator.vibrate) navigator.vibrate(50);
                    
                    this.submitting = true; 
                    
                     const formData = new FormData();
                     formData.append('observed_at', this.observed_at || new Date().toISOString().slice(0,16));
                     formData.append('lat', this.lat);
                     formData.append('lng', this.lng);
                     formData.append('csrf_token', this.csrfToken); // Add CSRF
                     formData.append('cultivation', this.cultivation);
                     formData.append('life_stage', this.life_stage);
                     formData.append('taxon_name', this.taxon_name); // Add taxon_name
                     formData.append('note', this.note);
                     
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
                         if (!navigator.onLine) throw new Error('Offline');

                         const res = await fetch('api/post_observation.php', {
                             method: 'POST',
                             body: formData
                         });
                         
                         // Catch server HTML errors (500/502/503 from Cloudflare/Nginx often return HTML)
                         const text = await res.text();
                         let result;
                         try { 
                            result = JSON.parse(text); 
                         } catch(e) { 
                            throw new Error('Server Error: ' + text.slice(0,100)); 
                         }

                         if (result.success) {
                             this.completeSubmission();
                         } else {
                             // Logic error (database fail etc) - probably dangerous to retry automatically?
                             // But let's save to draft at least? No, logic error means invalid data usually.
                             console.error('Submission Failed:', result);
                             alert('投稿エラー: ' + (result.message || result.error || '不明なエラー'));
                             this.submitting = false;
                         }
                     } catch (e) {
                         console.log('Network/Server failed, saving to Outbox...', e);
                         
                         // SAVE TO INDEXED DB
                         try {
                            await window.offlineManager.saveObservation(formData);
                            this.progress = 100;
                            this.success = true;
                            // Custom Success Message for Offline
                            // We need to slightly modify the success UI or just alert?
                            // Let's use the success variable but maybe change the text?
                            // For simplicity, we treat it as success.
                            if(navigator.vibrate) navigator.vibrate([50, 50]);
                            
                            // Visual feedback is "Success Checkmark" then redirect
                            // But we should probably tell them "Saved Offline"
                            alert('電波がありません。端末に保存しました。\nネットが繋がったら自動で送信されます。');
                            
                            localStorage.removeItem('draft_obs');
                            setTimeout(() => window.location.href='index.php', 500);
                         } catch(dbError) {
                             console.error('IndexedDB Failed:', dbError);
                             alert('保存に失敗しました: ' + e.message);
                             this.submitting = false;
                         }
                     }
                },

                completeSubmission() {
                     this.progress = 100;
                     this.success = true;
                     if(navigator.vibrate) navigator.vibrate([100, 50, 100]);
                     localStorage.removeItem('draft_obs');
                     setTimeout(() => window.location.href='index.php', 1500);
                }
            }
        }
    </script>
    <script>lucide.createIcons();</script>
</body>
</html>

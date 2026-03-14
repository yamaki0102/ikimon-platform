<?php
require_once __DIR__ . '/../../libs/Auth.php';
Auth::init();
Auth::requireRole('Analyst');
$currentUser = Auth::user();
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php $adminTitle = 'Speed-ID Verification';
    include __DIR__ . '/components/head.php'; ?>
</head>

<body class="flex h-screen overflow-hidden" x-data="verificationApp()">

    <?php $adminPage = 'verification';
    include __DIR__ . '/components/sidebar.php'; ?>

    <!-- Main Workspace -->
    <main class="flex-1 flex flex-col relative">
        <!-- Header -->
        <header class="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50">
            <div class="flex items-center gap-4">
                <h1 class="font-bold text-lg">Verification Queue</h1>
                <span class="px-2 py-1 bg-slate-800 rounded text-xs text-slate-400 font-mono" x-text="queue.length + ' Pending'"></span>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-xs text-slate-500">Expert Mode</span>
                <div class="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
            </div>
        </header>

        <!-- Deck Area -->
        <div class="flex-1 overflow-hidden relative flex items-center justify-center bg-[#05070a]">

            <!-- Loading State -->
            <div x-show="loading" class="absolute inset-0 flex items-center justify-center z-50 bg-[#05070a]">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>

            <!-- Empty State -->
            <div x-show="!loading && queue.length === 0" class="text-center">
                <div class="mb-4 inline-flex p-4 rounded-full bg-slate-800">
                    <i data-lucide="check-check" class="w-12 h-12 text-emerald-500"></i>
                </div>
                <h2 class="text-2xl font-bold mb-2">Queue Cleared!</h2>
                <p class="text-slate-400">Great work, expert.</p>
                <button @click="fetchQueue()" class="mt-6 px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-full font-bold transition">Check Again</button>
            </div>

            <!-- Card Stack -->
            <template x-if="currentObs">
                <div class="w-full max-w-5xl p-6 flex flex-col lg:flex-row gap-6 h-auto lg:h-full overflow-y-auto lg:overflow-hidden">

                    <!-- Image Panel -->
                    <div class="flex-none lg:flex-1 relative rounded-3xl overflow-hidden glass-panel group w-full lg:w-auto h-[40vh] lg:h-full">
                        <img :src="currentObs.image_url" :alt="(currentObs.taxon && currentObs.taxon.name) ? currentObs.taxon.name : '観察写真'" class="w-full h-full object-contain bg-black">

                        <!-- Metadata Overlay -->
                        <div class="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black/90 to-transparent">
                            <p class="text-slate-400 text-xs font-mono mb-1" x-text="currentObs.observed_at"></p>
                            <p class="text-white font-bold text-lg flex items-center gap-2">
                                <i data-lucide="map-pin" class="w-4 h-4 text-emerald-500"></i>
                                <span x-text="currentObs.location_name || 'Unknown Location'"></span>
                            </p>
                        </div>
                    </div>

                    <!-- Action Panel -->
                    <div class="w-full lg:w-96 flex flex-col gap-4 mt-6 lg:mt-0">

                        <!-- User Claim -->
                        <div class="p-4 rounded-2xl bg-slate-800 border border-slate-700">
                            <p class="text-xs text-slate-500 uppercase font-bold mb-2">User Claimed</p>
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                                    <i data-lucide="help-circle" class="w-5 h-5 text-slate-400"></i>
                                </div>
                                <div>
                                    <p class="font-bold text-lg" x-text="currentObs.taxon.name || 'Unknown'"></p>
                                    <p class="text-xs text-slate-400 italic">Confidence: Low</p>
                                </div>
                            </div>
                        </div>

                        <!-- Verify Form -->
                        <div class="flex-1 p-6 rounded-3xl bg-slate-800/50 border border-emerald-500/20 flex flex-col">
                            <h3 class="font-bold text-emerald-400 mb-4 flex items-center gap-2">
                                <i data-lucide="microscope" class="w-5 h-5"></i>
                                Expert Identification
                            </h3>

                            <!-- Auto-Suggest Buttons -->
                            <div class="grid grid-cols-2 gap-2 mb-6">
                                <template x-for="suggestion in suggestions">
                                    <button @click="idForm.name = suggestion" class="px-3 py-2 rounded-lg bg-slate-700 hover:bg-emerald-500/20 text-xs font-bold text-left truncate transition">
                                        <span x-text="suggestion"></span>
                                    </button>
                                </template>
                            </div>

                            <!-- Manual Input -->
                            <div class="mb-4">
                                <label class="block text-xs font-bold text-slate-400 mb-1">Species Name</label>
                                <input type="text" x-model="idForm.name" class="w-full bg-black/30 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-emerald-500 focus:outline-none">
                            </div>

                            <div class="mb-6">
                                <label class="block text-xs font-bold text-slate-400 mb-1">Comment (Optional)</label>
                                <textarea x-model="idForm.comment" rows="3" class="w-full bg-black/30 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-emerald-500 focus:outline-none text-sm"></textarea>
                            </div>

                            <div class="mt-auto flex gap-3">
                                <button @click="skip()" class="flex-1 py-3 rounded-xl bg-slate-700 font-bold hover:bg-slate-600 transition">Skip</button>
                                <button @click="verify()" class="flex-[2] py-3 rounded-xl bg-emerald-500 text-black font-black hover:bg-emerald-400 transition flex items-center justify-center gap-2">
                                    <i data-lucide="check" class="w-5 h-5"></i>
                                    Verify
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            </template>

        </div>
    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        function verificationApp() {
            return {
                loading: true,
                queue: [],
                currentIndex: 0,
                idForm: {
                    name: '',
                    comment: ''
                },
                suggestions: ['Tanuki', 'Red Fox', 'Cabbage White', 'Dandelion', 'Monarch'],

                get currentObs() {
                    return this.queue[this.currentIndex];
                },

                async init() {
                    await this.fetchQueue();
                },

                async fetchQueue() {
                    this.loading = true;
                    try {
                        const res = await fetch('../api/admin/get_queue.php');
                        const data = await res.json();
                        if (data.success) {
                            this.queue = data.data;
                            this.currentIndex = 0;
                            this.resetForm();
                        }
                    } catch (error) {
                        console.error('Error fetching queue:', error);
                    } finally {
                        this.loading = false;
                        setTimeout(() => lucide.createIcons(), 100);
                    }
                },

                resetForm() {
                    if (this.currentObs) {
                        this.idForm.name = this.currentObs.taxon.name || '';
                        this.idForm.comment = '';
                    }
                },

                skip() {
                    this.next();
                },

                async verify() {
                    const obs = this.currentObs;
                    if (!obs) return;

                    const payload = {
                        id: obs.id,
                        species_name: this.idForm.name,
                        comment: this.idForm.comment,
                        status: '種レベル研究用'
                    };

                    try {
                        const _csrf = (document.cookie.match(/(?:^|;\s*)ikimon_csrf=([a-f0-9]{64})/) || [])[1] || '';
                        await fetch('../api/admin/verify.php', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Csrf-Token': _csrf
                            },
                            body: JSON.stringify(payload)
                        });
                    } catch (e) {
                        alert('Verification failed');
                    }

                    this.next();
                },

                next() {
                    this.currentIndex++;
                    if (this.currentIndex >= this.queue.length) {
                        this.queue = [];
                    } else {
                        this.resetForm();
                    }
                }
            }
        }
    </script>
</body>

</html>

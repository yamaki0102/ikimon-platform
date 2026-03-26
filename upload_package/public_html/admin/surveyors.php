<?php
require_once __DIR__ . '/../../libs/Auth.php';
Auth::init();
Auth::requireRole('Admin');
$currentUser = Auth::user();
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php $adminTitle = '調査員管理'; include __DIR__ . '/components/head.php'; ?>
</head>
<body class="flex h-screen overflow-hidden" x-data="surveyorsAdmin()">
    <?php $adminPage = 'surveyors'; include __DIR__ . '/components/sidebar.php'; ?>

    <main class="flex-1 overflow-y-auto p-6 md:p-8">
        <header class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-bold">調査員管理</h1>
                <p class="text-sm text-slate-400 mt-1">面談日、申請メモ、承認理由を残しながら調査員運用を管理</p>
            </div>
        </header>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <p class="text-xs text-slate-400 font-bold uppercase">承認済み</p>
                <p class="text-2xl font-black text-sky-400" x-text="stats.approved">—</p>
            </div>
            <div class="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <p class="text-xs text-slate-400 font-bold uppercase">申請中</p>
                <p class="text-2xl font-black text-amber-400" x-text="stats.pending">—</p>
            </div>
            <div class="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <p class="text-xs text-slate-400 font-bold uppercase">停止中</p>
                <p class="text-2xl font-black text-red-400" x-text="stats.suspended">—</p>
            </div>
            <div class="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <p class="text-xs text-slate-400 font-bold uppercase">公開中</p>
                <p class="text-2xl font-black text-emerald-400" x-text="stats.publicVisible">—</p>
            </div>
        </div>

        <div class="mb-6">
            <input type="text" x-model="searchQuery" @input.debounce.200="filterUsers"
                placeholder="名前・地域・得意分野で検索..."
                class="w-full max-w-lg bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-sky-500">
        </div>

        <div class="space-y-4">
            <template x-if="loading">
                <div class="bg-slate-800 rounded-2xl border border-slate-700 px-6 py-12 text-center text-slate-500">読み込み中...</div>
            </template>
            <template x-for="user in filteredUsers" :key="user.id">
                <section class="bg-slate-800 rounded-2xl border border-slate-700 p-5">
                    <div class="flex flex-col lg:flex-row gap-5 lg:items-start">
                        <div class="flex items-center gap-4 min-w-0 lg:w-72">
                            <img :src="user.avatar || ''" :alt="(user.name || 'ユーザー') + 'のアバター'" class="w-14 h-14 rounded-2xl bg-slate-700 object-cover">
                            <div class="min-w-0">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <p class="font-bold text-white" x-text="user.name"></p>
                                    <span class="text-[10px] px-2 py-0.5 rounded-full border"
                                        :class="{
                                            'text-sky-400 border-sky-500/30 bg-sky-500/10': user.surveyor_status === 'approved',
                                            'text-amber-400 border-amber-500/30 bg-amber-500/10': user.surveyor_status === 'pending',
                                            'text-red-400 border-red-500/30 bg-red-500/10': user.surveyor_status === 'suspended',
                                            'text-slate-400 border-slate-600 bg-slate-700/50': user.surveyor_status === 'none'
                                        }"
                                        x-text="user.surveyor_status"></span>
                                </div>
                                <p class="text-xs text-slate-500 mt-1" x-text="user.id"></p>
                                <p class="text-xs text-slate-400 mt-2" x-text="user.surveyor_public_visible ? '公開中' : '非公開'"></p>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1">
                            <div class="space-y-3">
                                <div>
                                    <label class="block text-[11px] font-bold text-slate-400 mb-1">状態</label>
                                    <select x-model="user.surveyor_status" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm">
                                        <option value="none">none</option>
                                        <option value="pending">pending</option>
                                        <option value="approved">approved</option>
                                        <option value="suspended">suspended</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-[11px] font-bold text-slate-400 mb-1">面談日</label>
                                    <input type="date" x-model="user.surveyor_admin.interview_date" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm">
                                </div>
                                <div>
                                    <label class="block text-[11px] font-bold text-slate-400 mb-1">承認理由</label>
                                    <textarea x-model="user.surveyor_admin.approval_reason" class="w-full h-24 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm"></textarea>
                                </div>
                            </div>

                            <div class="space-y-3">
                                <div>
                                    <label class="block text-[11px] font-bold text-slate-400 mb-1">申請メモ</label>
                                    <textarea x-model="user.surveyor_admin.application_note" class="w-full h-40 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm"></textarea>
                                </div>
                                <div>
                                    <p class="text-[11px] font-bold text-slate-400 mb-2">変更履歴</p>
                                    <div class="max-h-40 overflow-y-auto space-y-2 pr-1">
                                        <template x-if="!user.surveyor_status_history || user.surveyor_status_history.length === 0">
                                            <div class="text-xs text-slate-500">まだ履歴はありません</div>
                                        </template>
                                        <template x-for="entry in (user.surveyor_status_history || []).slice().reverse()" :key="entry.id">
                                            <div class="rounded-xl bg-slate-900 border border-slate-700 px-3 py-2">
                                                <p class="text-xs font-bold text-white"><span x-text="entry.from"></span> → <span x-text="entry.to"></span></p>
                                                <p class="text-[11px] text-slate-400 mt-1" x-text="entry.actor_name + ' / ' + entry.created_at"></p>
                                                <p x-show="entry.note" class="text-[11px] text-slate-500 mt-1" x-text="entry.note"></p>
                                            </div>
                                        </template>
                                    </div>
                                </div>
                                <div class="flex items-center gap-3">
                                    <button @click="save(user)" class="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-sm font-bold">保存</button>
                                    <a x-show="user.surveyor_status === 'approved'" :href="'../surveyor_profile.php?id=' + encodeURIComponent(user.id)" target="_blank" rel="noopener noreferrer" class="text-xs text-sky-400 hover:underline">公開ページを見る</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </template>
        </div>
    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        function surveyorsAdmin() {
            return {
                loading: true,
                searchQuery: '',
                users: [],
                filteredUsers: [],
                stats: { approved: 0, pending: 0, suspended: 0, publicVisible: 0 },
                async init() {
                    await this.fetchUsers();
                },
                async fetchUsers() {
                    this.loading = true;
                    try {
                        const res = await fetch('../api/admin/get_users.php');
                        const data = await res.json();
                        if (data.success) {
                            this.users = data.data.filter(u => u.surveyor_status !== 'none' || u.surveyor_admin.application_note || u.surveyor_admin.interview_date || u.surveyor_admin.approval_reason);
                            this.filteredUsers = this.users;
                            this.computeStats();
                        }
                    } finally {
                        this.loading = false;
                    }
                },
                computeStats() {
                    this.stats.approved = this.users.filter(u => u.surveyor_status === 'approved').length;
                    this.stats.pending = this.users.filter(u => u.surveyor_status === 'pending').length;
                    this.stats.suspended = this.users.filter(u => u.surveyor_status === 'suspended').length;
                    this.stats.publicVisible = this.users.filter(u => u.surveyor_public_visible).length;
                },
                filterUsers() {
                    const q = this.searchQuery.toLowerCase();
                    if (!q) {
                        this.filteredUsers = this.users;
                        return;
                    }
                    this.filteredUsers = this.users.filter(u => {
                        const text = [
                            u.name || '',
                            u.id || '',
                            u.surveyor_admin?.application_note || '',
                            u.surveyor_admin?.approval_reason || '',
                        ].join(' ').toLowerCase();
                        return text.includes(q);
                    });
                },
                async save(user) {
                    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
                    const res = await fetch('../api/admin/update_surveyor_status.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': csrfToken
                        },
                        body: JSON.stringify({
                            id: user.id,
                            status: user.surveyor_status,
                            application_note: user.surveyor_admin.application_note,
                            interview_date: user.surveyor_admin.interview_date,
                            approval_reason: user.surveyor_admin.approval_reason
                        })
                    });
                    const data = await res.json();
                    if (!data.success) {
                        alert(data.message || '保存に失敗しました');
                        return;
                    }
                    await this.fetchUsers();
                }
            };
        }
        lucide.createIcons();
    </script>
</body>
</html>

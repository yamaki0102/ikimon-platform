<?php
require_once __DIR__ . '/../../libs/Auth.php';
Auth::init();
Auth::requireRole('Admin'); // Only Admins can manage users
$currentUser = Auth::user();
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php $adminTitle = 'ユーザー管理';
    include __DIR__ . '/components/head.php'; ?>
</head>

<body class="flex h-screen overflow-hidden" x-data="usersApp()">

    <?php $adminPage = 'users';
    include __DIR__ . '/components/sidebar.php'; ?>

    <!-- Main -->
    <main class="flex-1 overflow-y-auto p-6 md:p-8">
        <header class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-bold">ユーザー管理</h1>
                <p class="text-sm text-slate-400 mt-1">ロール変更・BAN管理</p>
            </div>
        </header>

        <!-- Stats -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <p class="text-xs text-slate-400 font-bold uppercase">総ユーザー</p>
                <p class="text-2xl font-black text-blue-400" x-text="stats.total">—</p>
            </div>
            <div class="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <p class="text-xs text-slate-400 font-bold uppercase">専門家</p>
                <p class="text-2xl font-black text-violet-400" x-text="stats.specialists">—</p>
            </div>
            <div class="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <p class="text-xs text-slate-400 font-bold uppercase">管理者</p>
                <p class="text-2xl font-black text-amber-400" x-text="stats.admins">—</p>
            </div>
            <div class="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <p class="text-xs text-slate-400 font-bold uppercase">BAN中</p>
                <p class="text-2xl font-black text-red-400" x-text="stats.banned">—</p>
            </div>
        </div>

        <!-- Search -->
        <div class="mb-6">
            <input type="text" x-model="searchQuery" @input.debounce.300="filterUsers"
                placeholder="名前・ID・メールで検索..."
                class="w-full max-w-md bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-emerald-500">
        </div>

        <!-- User Table -->
        <div class="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <table class="w-full text-sm text-left">
                <thead class="text-xs text-slate-400 uppercase bg-slate-900/50">
                    <tr>
                        <th class="px-4 py-3">ユーザー</th>
                        <th class="px-4 py-3">ロール</th>
                        <th class="px-4 py-3">参加日</th>
                        <th class="px-4 py-3">投稿数</th>
                        <th class="px-4 py-3">操作</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-700">
                    <template x-if="loading">
                        <tr>
                            <td class="px-4 py-8 text-center text-slate-500" colspan="5">読み込み中...</td>
                        </tr>
                    </template>
                    <template x-if="!loading && filteredUsers.length === 0">
                        <tr>
                            <td class="px-4 py-8 text-center text-slate-500" colspan="5">ユーザーが見つかりません</td>
                        </tr>
                    </template>
                    <template x-for="user in filteredUsers" :key="user.id">
                        <tr class="hover:bg-slate-700/50 transition">
                            <td class="px-4 py-3 flex items-center gap-3">
                                <img :src="user.avatar || ''" class="w-8 h-8 rounded-full bg-slate-700" onerror="this.style.display='none'">
                                <div>
                                    <p class="font-bold" x-text="user.name"></p>
                                    <p class="text-xs text-slate-500" x-text="user.id"></p>
                                </div>
                            </td>
                            <td class="px-4 py-3">
                                <select @change="changeRole(user.id, $event.target.value)"
                                    :class="{
                                        'text-emerald-400': user.role === 'Admin',
                                        'text-violet-400': user.role === 'Specialist' || user.role === 'Analyst',
                                        'text-slate-400': user.role === 'Observer'
                                    }"
                                    class="bg-transparent border-0 text-sm font-bold focus:outline-none cursor-pointer">
                                    <template x-for="role in ['Observer', 'Specialist', 'Analyst', 'Admin']">
                                        <option :value="role" :selected="user.role === role" x-text="role"
                                            class="bg-slate-800 text-white"></option>
                                    </template>
                                </select>
                            </td>
                            <td class="px-4 py-3 text-slate-400 text-xs" x-text="user.created_at ? new Date(user.created_at).toLocaleDateString('ja-JP') : '—'"></td>
                            <td class="px-4 py-3 text-slate-400" x-text="user.observation_count ?? '—'"></td>
                            <td class="px-4 py-3">
                                <button @click="toggleBan(user)" :class="user.banned ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-red-400 hover:bg-red-500/10'"
                                    class="px-3 py-1.5 rounded-lg text-xs font-bold transition">
                                    <span x-text="user.banned ? 'BAN解除' : 'ShadowBAN'"></span>
                                </button>
                            </td>
                        </tr>
                    </template>
                </tbody>
            </table>
        </div>
    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        function usersApp() {
            return {
                loading: true,
                searchQuery: '',
                users: [],
                filteredUsers: [],
                stats: {
                    total: 0,
                    specialists: 0,
                    admins: 0,
                    banned: 0
                },

                async init() {
                    await this.fetchUsers();
                },

                async fetchUsers() {
                    this.loading = true;
                    try {
                        const res = await fetch('../api/admin/list_users.php');
                        const data = await res.json();
                        if (data.success) {
                            this.users = data.data;
                            this.filteredUsers = this.users;
                            this.computeStats();
                        }
                    } catch (e) {
                        console.error('Error fetching users:', e);
                    } finally {
                        this.loading = false;
                    }
                },

                computeStats() {
                    this.stats.total = this.users.length;
                    this.stats.specialists = this.users.filter(u => ['Specialist', 'Analyst'].includes(u.role)).length;
                    this.stats.admins = this.users.filter(u => u.role === 'Admin').length;
                    this.stats.banned = this.users.filter(u => u.banned).length;
                },

                filterUsers() {
                    const q = this.searchQuery.toLowerCase();
                    if (!q) {
                        this.filteredUsers = this.users;
                        return;
                    }
                    this.filteredUsers = this.users.filter(u =>
                        (u.name || '').toLowerCase().includes(q) ||
                        (u.id || '').toLowerCase().includes(q) ||
                        (u.email || '').toLowerCase().includes(q)
                    );
                },

                async changeRole(userId, newRole) {
                    if (!confirm(`ロールを ${newRole} に変更しますか？`)) {
                        await this.fetchUsers();
                        return;
                    }
                    try {
                        await fetch('../api/admin/change_role.php', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                user_id: userId,
                                role: newRole
                            })
                        });
                        await this.fetchUsers();
                    } catch (e) {
                        alert('Error changing role');
                    }
                },

                async toggleBan(user) {
                    const action = user.banned ? 'unban' : 'ban';
                    const msg = user.banned ? 'BAN解除しますか？' : 'ShadowBANしますか？';
                    if (!confirm(msg)) return;

                    try {
                        await fetch('../api/admin/toggle_ban.php', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                user_id: user.id,
                                action
                            })
                        });
                        await this.fetchUsers();
                    } catch (e) {
                        alert('Error toggling ban');
                    }
                }
            }
        }
    </script>
</body>

</html>
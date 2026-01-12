<?php
require_once __DIR__ . '/../../libs/Auth.php';
Auth::init();
Auth::requireRole('Admin'); // Only Admins can manage users
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>User Management | ikimon Admin</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Montserrat:wght@800&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/lucide@latest"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
    <style>
        body { font-family: 'Inter', sans-serif; background: #0f172a; color: #f1f5f9; }
        .font-brand { font-family: 'Montserrat', sans-serif; }
    </style>
</head>
<body class="flex h-screen overflow-hidden" x-data="userManagement()">
    
    <!-- Sidebar -->
    <aside class="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div class="p-6 flex items-center gap-3">
            <div class="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center font-brand font-black text-slate-900">i</div>
            <span class="font-brand font-black text-xl tracking-tight">ikimon <span class="text-xs text-slate-500 font-normal">Admin</span></span>
        </div>

        <nav class="flex-1 px-4 space-y-2">
            <a href="index.php" class="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl font-bold transition">
                <i data-lucide="layout-dashboard" class="w-5 h-5"></i>
                Dashboard
            </a>
            <a href="verification.php" class="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl font-bold transition">
                <i data-lucide="check-circle-2" class="w-5 h-5"></i>
                Verification
            </a>
            <a href="users.php" class="flex items-center gap-3 px-4 py-3 bg-slate-800 text-white rounded-xl font-bold transition">
                <i data-lucide="users" class="w-5 h-5"></i>
                Users & Roles
            </a>
            <a href="corporate.php" class="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl font-bold transition">
                <i data-lucide="building-2" class="w-5 h-5"></i>
                Corporate
            </a>
        </nav>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto p-8">
        <header class="flex justify-between items-center mb-8">
            <h1 class="text-2xl font-bold">User Management</h1>
            <div class="relative">
                <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"></i>
                <input type="text" x-model="search" placeholder="Search users..." class="bg-slate-800 border border-slate-700 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-emerald-500 w-64">
            </div>
        </header>

        <!-- User Table -->
        <div class="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <table class="w-full text-sm text-left">
                <thead class="text-xs text-slate-400 uppercase bg-slate-900/50">
                    <tr>
                        <th class="px-6 py-4">User</th>
                        <th class="px-6 py-4">Role</th>
                        <th class="px-6 py-4">Activity</th>
                        <th class="px-6 py-4">Status</th>
                        <th class="px-6 py-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-700">
                    <template x-for="user in filteredUsers" :key="user.id">
                        <tr class="hover:bg-slate-700/50 transition">
                            <td class="px-6 py-4">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-full bg-slate-700 overflow-hidden">
                                        <img :src="user.avatar" class="w-full h-full object-cover">
                                    </div>
                                    <div>
                                        <p class="font-bold text-white" x-text="user.name"></p>
                                        <p class="text-xs text-slate-500" x-text="user.email || 'No email'"></p>
                                    </div>
                                </div>
                            </td>
                            <td class="px-6 py-4">
                                <span class="px-2 py-1 rounded text-xs font-bold border" 
                                      :class="{
                                          'bg-blue-500/10 text-blue-400 border-blue-500/20': user.role === 'Observer',
                                          'bg-purple-500/10 text-purple-400 border-purple-500/20': user.role === 'Specialist',
                                          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20': user.role === 'Analyst',
                                          'bg-red-500/10 text-red-400 border-red-500/20': user.role === 'Admin'
                                      }"
                                      x-text="user.role">
                                </span>
                            </td>
                            <td class="px-6 py-4">
                                <div class="flex flex-col text-xs">
                                    <span class="text-slate-300">Joined <span class="font-bold" x-text="user.created_at || 'N/A'"></span></span>
                                    <span class="text-slate-500">Last <span x-text="user.last_login_at || '未ログイン'"></span></span>
                                </div>
                            </td>
                            <td class="px-6 py-4">
                                <template x-if="user.banned">
                                    <span class="flex items-center gap-1 text-red-500 font-bold text-xs"><i data-lucide="ban" class="w-3 h-3"></i> Banned</span>
                                </template>
                                <template x-if="!user.banned">
                                    <span class="text-emerald-500 font-bold text-xs">Active</span>
                                </template>
                            </td>
                            <td class="px-6 py-4 text-right">
                                <div class="flex items-center justify-end gap-2">
                                    <button @click="openRoleModal(user)" class="p-2 hover:bg-slate-600 rounded-lg text-slate-400 hover:text-white transition" title="Edit Role">
                                        <i data-lucide="shield" class="w-4 h-4"></i>
                                    </button>
                                    <button @click="toggleBan(user)" class="p-2 hover:bg-red-900/50 rounded-lg transition" :class="user.banned ? 'text-red-500' : 'text-slate-400 hover:text-red-400'" title="Ban User">
                                        <i data-lucide="gavel" class="w-4 h-4"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </template>
                </tbody>
            </table>
        </div>

        <!-- Role Edit Modal -->
        <div x-show="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" x-cloak>
            <div class="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md p-6" @click.outside="showModal = false">
                <h3 class="text-xl font-bold mb-4">Edit User Role</h3>
                <div class="mb-6" x-if="editingUser">
                     <p class="text-sm text-slate-400 mb-2">Assigning role for <strong class="text-white" x-text="editingUser.name"></strong></p>
                     
                     <div class="space-y-2">
                         <label class="flex items-center gap-3 p-3 rounded-xl border border-slate-700 hover:bg-slate-700 cursor-pointer transition">
                             <input type="radio" name="role" value="Observer" x-model="selectedRole" class="accent-emerald-500">
                             <div>
                                 <p class="font-bold text-sm">Observer</p>
                                 <p class="text-xs text-slate-500">Standard user. Can add posts.</p>
                             </div>
                         </label>
                         <label class="flex items-center gap-3 p-3 rounded-xl border border-slate-700 hover:bg-slate-700 cursor-pointer transition">
                             <input type="radio" name="role" value="Specialist" x-model="selectedRole" class="accent-purple-500">
                             <div>
                                 <p class="font-bold text-sm">Specialist</p>
                                 <p class="text-xs text-slate-500">Trusted user. Can help verify common species.</p>
                             </div>
                         </label>
                         <label class="flex items-center gap-3 p-3 rounded-xl border border-slate-700 hover:bg-slate-700 cursor-pointer transition">
                             <input type="radio" name="role" value="Analyst" x-model="selectedRole" class="accent-blue-500">
                             <div>
                                 <p class="font-bold text-sm">Analyst</p>
                                 <p class="text-xs text-slate-500">Expert/Staff. Can verify Research Grade.</p>
                             </div>
                         </label>
                     </div>
                </div>
                <div class="flex gap-3">
                    <button @click="showModal = false" class="flex-1 py-2 rounded-lg font-bold text-slate-400 hover:bg-slate-700">Cancel</button>
                    <button @click="saveRole()" class="flex-1 py-2 rounded-lg bg-emerald-500 text-black font-bold hover:bg-emerald-400">Save Changes</button>
                </div>
            </div>
        </div>

    </main>

    <script>
        function userManagement() {
            return {
                users: [],
                search: '',
                showModal: false,
                editingUser: null,
                selectedRole: '',

                async init() {
                    await this.loadUsers();
                },

                async loadUsers() {
                    const res = await fetch('../api/admin/get_users.php');
                    const data = await res.json();
                    if (data.success) {
                        this.users = data.data;
                    }
                },

                get filteredUsers() {
                    if (!this.search) return this.users;
                    return this.users.filter(u => u.name.toLowerCase().includes(this.search.toLowerCase()));
                },

                openRoleModal(user) {
                    this.editingUser = user;
                    this.selectedRole = user.role;
                    this.showModal = true;
                },

                async saveRole() {
                    if (!this.editingUser) return;
                    const res = await fetch('../api/admin/update_role.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: this.editingUser.id, role: this.selectedRole })
                    });
                    const data = await res.json();
                    if (data.success) {
                        this.editingUser.rank = data.data.rank;
                        this.editingUser.role = data.data.role;
                        this.showModal = false;
                    }
                },

                async toggleBan(user) {
                    if (!confirm('Are you sure you want to ' + (user.banned ? 'unban' : 'ban') + ' this user?')) return;
                    const res = await fetch('../api/admin/toggle_ban.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: user.id, banned: !user.banned })
                    });
                    const data = await res.json();
                    if (data.success) {
                        user.banned = data.data.banned;
                    }
                }
            }
        }
        lucide.createIcons();
    </script>
</body>
</html>

<?php

/**
 * FB-18/19: Loading States & Error Handler Component
 * Provides consistent loading spinners and error displays
 */
?>

<!-- Loading Overlay Component -->
<template x-teleport="body">
    <div x-show="$store.loading.show"
        x-transition:enter="transition ease-out duration-200"
        x-transition:enter-start="opacity-0"
        x-transition:enter-end="opacity-100"
        x-transition:leave="transition ease-in duration-150"
        x-transition:leave-start="opacity-100"
        x-transition:leave-end="opacity-0"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div class="text-center">
            <div class="relative w-16 h-16 mx-auto mb-4">
                <div class="absolute inset-0 rounded-full border-4 border-white/20"></div>
                <div class="absolute inset-0 rounded-full border-4 border-t-[var(--color-primary)] animate-spin"></div>
            </div>
            <p class="text-white font-bold" x-text="$store.loading.message || '読み込み中...'"></p>
        </div>
    </div>
</template>

<!-- Toast Notification Component -->
<template x-teleport="body">
    <div class="fixed bottom-4 right-4 z-[9998] space-y-2 pointer-events-none">
        <template x-for="toast in $store.toast.items" :key="toast.id">
            <div x-show="toast.visible"
                x-transition:enter="transition ease-out duration-300 transform"
                x-transition:enter-start="opacity-0 translate-x-8"
                x-transition:enter-end="opacity-100 translate-x-0"
                x-transition:leave="transition ease-in duration-200 transform"
                x-transition:leave-start="opacity-100 translate-x-0"
                x-transition:leave-end="opacity-0 translate-x-8"
                class="pointer-events-auto glass-card px-6 py-4 rounded-2xl border flex items-center gap-3 min-w-[300px] shadow-2xl"
                :class="{
                     'border-green-500/30 bg-green-500/10': toast.type === 'success',
                     'border-red-500/30 bg-red-500/10': toast.type === 'error',
                     'border-yellow-500/30 bg-yellow-500/10': toast.type === 'warning',
                     'border-blue-500/30 bg-blue-500/10': toast.type === 'info'
                 }">
                <div class="shrink-0">
                    <template x-if="toast.type === 'success'">
                        <i data-lucide="check-circle" class="w-5 h-5 text-green-400"></i>
                    </template>
                    <template x-if="toast.type === 'error'">
                        <i data-lucide="x-circle" class="w-5 h-5 text-red-400"></i>
                    </template>
                    <template x-if="toast.type === 'warning'">
                        <i data-lucide="alert-triangle" class="w-5 h-5 text-yellow-400"></i>
                    </template>
                    <template x-if="toast.type === 'info'">
                        <i data-lucide="info" class="w-5 h-5 text-blue-400"></i>
                    </template>
                </div>
                <div class="flex-1">
                    <p class="font-bold text-sm" x-text="toast.title"></p>
                    <p class="text-xs text-muted" x-text="toast.message" x-show="toast.message"></p>
                </div>
                <button @click="$store.toast.dismiss(toast.id)" class="shrink-0 text-muted hover:text-text transition">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
        </template>
    </div>
</template>

<script nonce="<?= CspNonce::attr() ?>">
    // Alpine.js Store for Loading State
    document.addEventListener('alpine:init', () => {
        Alpine.store('loading', {
            show: false,
            message: '',

            start(message = '読み込み中...') {
                this.message = message;
                this.show = true;
            },

            stop() {
                this.show = false;
                this.message = '';
            }
        });

        // Alpine.js Store for Toast Notifications
        Alpine.store('toast', {
            items: [],
            nextId: 0,

            show(type, title, message = '', duration = 5000) {
                const id = this.nextId++;
                this.items.push({
                    id,
                    type,
                    title,
                    message,
                    visible: true
                });

                // Refresh Lucide icons
                setTimeout(() => lucide.createIcons(), 10);

                // Auto dismiss
                if (duration > 0) {
                    setTimeout(() => this.dismiss(id), duration);
                }

                return id;
            },

            success(title, message = '') {
                return this.show('success', title, message);
            },

            error(title, message = '') {
                return this.show('error', title, message, 8000); // Longer for errors
            },

            warning(title, message = '') {
                return this.show('warning', title, message);
            },

            info(title, message = '') {
                return this.show('info', title, message);
            },

            dismiss(id) {
                const toast = this.items.find(t => t.id === id);
                if (toast) {
                    toast.visible = false;
                    setTimeout(() => {
                        this.items = this.items.filter(t => t.id !== id);
                    }, 300);
                }
            }
        });
    });

    // Global Error Handler
    window.handleApiError = function(error, context = '') {
        console.error('API Error:', error, context);

        let title = 'エラーが発生しました';
        let message = '';

        if (error.message) {
            message = error.message;
        } else if (typeof error === 'string') {
            message = error;
        }

        // Rate limit specific handling
        if (error.status === 429) {
            title = 'リクエスト制限';
            message = 'しばらく待ってから再度お試しください。';
        }

        // Network error
        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
            title = '接続エラー';
            message = 'ネットワーク接続を確認してください。';
        }

        Alpine.store('toast').error(title, message);
    };

    // Enhanced fetch wrapper with loading & error handling
    window.apiFetch = async function(url, options = {}, loadingMessage = null) {
        const store = Alpine.store('loading');
        const toast = Alpine.store('toast');

        try {
            if (loadingMessage) {
                store.start(loadingMessage);
            }

            const response = await fetch(url, {
                ...options,
                headers: {
                    'Accept': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}`);
                error.status = response.status;
                throw error;
            }

            const data = await response.json();

            if (data.success === false) {
                throw new Error(data.message || 'Unknown error');
            }

            return data;

        } catch (error) {
            handleApiError(error);
            throw error;
        } finally {
            if (loadingMessage) {
                store.stop();
            }
        }
    };
</script>
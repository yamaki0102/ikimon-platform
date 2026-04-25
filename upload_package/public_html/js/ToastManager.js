class ToastManager {
    constructor() {
        this.container = document.createElement('div');
        this.container.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4 flex flex-col gap-2 pointer-events-none';
        document.body.appendChild(this.container);
    }

    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - 'success', 'error', 'info', 'quest'
     * @param {number} duration - Duration in ms (default 3000)
     */
    show(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');

        // Base styles
        let bgClass = 'bg-[#1f2937] border-white/10 text-white';
        let icon = 'info';

        if (type === 'success') {
            bgClass = 'bg-green-500/90 text-black font-bold shadow-[0_0_20px_rgba(34,197,94,0.3)]';
            icon = 'check-circle';
        } else if (type === 'error') {
            bgClass = 'bg-red-500/90 text-white font-bold shadow-[0_0_20px_rgba(239,68,68,0.3)]';
            icon = 'alert-circle';
        } else if (type === 'quest') {
            bgClass = 'bg-yellow-400 text-black font-black border-2 border-yellow-200 shadow-[0_0_30px_rgba(250,204,21,0.5)]';
            icon = 'trophy';
        }

        toast.className = `
            ${bgClass} backdrop-blur-md rounded-2xl px-4 py-3 shadow-2xl border
            transform transition-all duration-300 ease-out translate-y-[-20px] opacity-0 scale-95
            flex items-center gap-3 pointer-events-auto select-none
        `;

        toast.innerHTML = `
            <i data-lucide="${icon}" class="w-5 h-5 flex-shrink-0"></i>
            <p class="text-sm leading-tight flex-1">${message}</p>
        `;

        this.container.appendChild(toast);

        // Re-render icons for new element
        if (window.lucide) window.lucide.createIcons({ root: toast });

        // Enter animation
        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-[-20px]', 'opacity-0', 'scale-95');
        });

        // Haptic Feedback
        if (navigator.vibrate) {
            if (type === 'success') navigator.vibrate([50, 50]);
            if (type === 'error') navigator.vibrate([100, 50, 100]);
            if (type === 'quest') navigator.vibrate([50, 50, 50, 50, 200]);
        }

        // Sound Feedback
        if (window.SoundManager) {
            if (type === 'success') SoundManager.play('pop');
            if (type === 'quest') SoundManager.play('success');
        }

        // Auto remove
        setTimeout(() => {
            toast.classList.add('opacity-0', 'scale-90', 'translate-y-[-10px]');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
}

// Initialize on load
window.Toast = new ToastManager();

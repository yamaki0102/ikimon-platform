<?php IF(!isset($currentUser)): ?>
<div x-data="{ open: true }" x-show="open" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"></div>
    
    <!-- Modal -->
    <div class="relative w-full max-w-sm bg-[var(--color-bg-base)] border border-white/10 rounded-3xl p-6 shadow-2xl text-center overflow-hidden">
        <!-- Background Decor -->
        <div class="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/20 to-transparent"></div>
        
        <div class="relative">
            <h2 class="text-2xl font-black mb-2">Welcome to ikimon</h2>
            <p class="text-gray-400 text-sm mb-6">Discover and share the biodiversity around you.</p>
            
            <div class="flex flex-col gap-3">
                <a href="login.php" class="btn-primary w-full justify-center">
                    Login
                </a>
                <a href="register.php" class="btn-secondary w-full justify-center">
                    Create Account
                </a>
                <button @click="open = false" class="text-xs text-gray-500 hover:text-white mt-4 underline decoration-white/20">
                    Browse as Guest
                </button>
            </div>
        </div>
    </div>
</div>
<?php ENDIF; ?>

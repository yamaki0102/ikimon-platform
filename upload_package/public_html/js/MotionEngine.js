/**
 * MotionEngine.js
 * Visual feedback system (Particles, Physics).
 * "If it moves, it should feel alive."
 */
const MotionEngine = {
    init() {
        // Global click listener for general interactions
        document.addEventListener('click', (e) => this.handleGlobalClick(e), true);
    },

    handleGlobalClick(e) {
        // Ripple effect or similar could go here
        // For now, we delegate specific triggers
    },

    /**
     * Create a particle explosion at x, y
     * @param {number} x ClientX
     * @param {number} y ClientY
     * @param {string} color (optional)
     */
    explode(x, y, color = '#fbbf24') {
        const count = 12;
        for (let i = 0; i < count; i++) {
            this.createParticle(x, y, color);
        }
    },

    createParticle(x, y, color) {
        const p = document.createElement('div');
        p.style.position = 'fixed';
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        p.style.width = (Math.random() * 6 + 4) + 'px';
        p.style.height = p.style.width;
        p.style.backgroundColor = color;
        p.style.borderRadius = '50%';
        p.style.pointerEvents = 'none';
        p.style.zIndex = '9999';

        // Random velocity
        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * 100 + 50; // px per sec
        const vx = Math.cos(angle) * velocity;
        const vy = Math.sin(angle) * velocity;

        document.body.appendChild(p);

        // Animation
        const duration = 600;
        const start = performance.now();

        const animate = (now) => {
            const elapsed = now - start;
            const progress = elapsed / duration;

            if (progress >= 1) {
                p.remove();
                return;
            }

            // Physics (Gravity)
            const currentVy = vy + (progress * 200); // Fake gravity

            const dx = vx * (elapsed / 1000);
            const dy = currentVy * (elapsed / 1000);

            // Fade & Shrink
            p.style.opacity = 1 - progress;
            p.style.transform = `translate(${dx}px, ${dy}px) scale(${1 - progress * 0.5})`;

            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }
};

MotionEngine.init();
window.MotionEngine = MotionEngine;

<div id="radar-layer" class="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[var(--color-bg-base)]">
    <canvas id="bio-radar-canvas" class="w-full h-full opacity-40"></canvas>

    <!-- Vignette (light version) -->
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(255,255,255,0.6)_100%)]"></div>
</div>

<script nonce="<?= CspNonce::attr() ?>">
    document.addEventListener('DOMContentLoaded', () => {
        const canvas = document.getElementById('bio-radar-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let width, height;

        const resize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resize);
        resize();

        // Particles
        const particles = Array.from({
            length: 40
        }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            r: Math.random() * 2 + 0.5,
            speed: Math.random() * 0.5 + 0.1,
            angle: Math.random() * Math.PI * 2,
            life: Math.random()
        }));

        function draw() {
            ctx.clearRect(0, 0, width, height);

            // Radar Grid (light)
            ctx.strokeStyle = 'rgba(13, 162, 231, 0.06)';
            ctx.lineWidth = 1;

            // Concentric Circles
            const cx = width / 2;
            const cy = height / 2;
            const maxR = Math.max(width, height) / 2;

            for (let r = 50; r < maxR; r += 100) {
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.stroke();
            }

            // Scan line
            const time = Date.now() / 2000;
            const scanAngle = time % (Math.PI * 2);

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(scanAngle);
            const grad = ctx.createLinearGradient(0, 0, maxR, 0);
            grad.addColorStop(0, 'rgba(13, 162, 231, 0)');
            grad.addColorStop(1, 'rgba(13, 162, 231, 0.08)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, maxR, -0.2, 0);
            ctx.fill();
            ctx.restore();

            // Particles (Organic Dust — lighter)
            ctx.fillStyle = 'rgba(13, 162, 231, 0.3)';
            particles.forEach(p => {
                p.x += Math.cos(p.angle) * p.speed;
                p.y += Math.sin(p.angle) * p.speed;
                p.life -= 0.005;

                if (p.life <= 0 || p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
                    p.x = Math.random() * width;
                    p.y = Math.random() * height;
                    p.life = 1;
                }

                ctx.globalAlpha = p.life * 0.35;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
            });

            requestAnimationFrame(draw);
        }

        draw();
    });
</script>
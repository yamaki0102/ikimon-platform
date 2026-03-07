/**
 * PassiveStepTracker — Site-wide daily step counter
 * Loads on every page via footer.php. Counts steps in background using
 * DeviceMotionEvent and persists daily totals in localStorage.
 *
 * Data flow:
 * - localStorage key: ikimon_passive_steps
 * - Format: { date: "2026-03-07", steps: 1234, permissionGranted: true }
 * - Resets automatically at midnight (date change)
 * - field_research.php uses its own StepCounter instance for GPS sessions;
 *   this tracker runs independently for "ambient" step counting.
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'ikimon_passive_steps';
    const SAVE_INTERVAL = 5000; // persist to localStorage every 5s

    // Skip if StepCounter class not available or sensor not supported
    if (typeof StepCounter === 'undefined' || !StepCounter.isSupported()) return;

    // Skip on field_research.php — it has its own StepCounter integration
    if (location.pathname.includes('field_research.php')) return;

    const counter = new StepCounter();
    let saveTimer = null;

    /**
     * Get today's date string in YYYY-MM-DD format.
     */
    function today() {
        const d = new Date();
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');
    }

    /**
     * Load persisted state from localStorage.
     */
    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    /**
     * Save current state to localStorage.
     */
    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                date: today(),
                steps: counter.getSteps(),
                permissionGranted: counter.permissionGranted
            }));
        } catch (e) { /* quota exceeded — non-fatal */ }
    }

    /**
     * Restore previous count if same day, otherwise reset.
     */
    function restore() {
        const state = load();
        if (state && state.date === today()) {
            counter.setSteps(state.steps || 0);
            counter.permissionGranted = !!state.permissionGranted;
        }
        // Different day or no state → starts at 0 (default)
    }

    /**
     * Start counting. Called after permission is granted.
     */
    function startCounting() {
        counter.start();
        saveTimer = setInterval(save, SAVE_INTERVAL);

        // Save on page unload
        window.addEventListener('pagehide', save);
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') save();
        });
    }

    /**
     * Initialize: restore state, request permission on first user gesture.
     */
    function init() {
        restore();

        // If permission was previously granted (Android, or iOS already approved)
        if (counter.permissionGranted) {
            startCounting();
            return;
        }

        // iOS requires user gesture for DeviceMotionEvent.requestPermission()
        // Wait for first tap/click, then request
        const onGesture = async () => {
            document.removeEventListener('click', onGesture);
            document.removeEventListener('touchstart', onGesture);

            const granted = await counter.requestPermission();
            if (granted) {
                startCounting();
                save(); // persist permissionGranted flag
            }
        };

        document.addEventListener('click', onGesture, { once: true });
        document.addEventListener('touchstart', onGesture, { once: true });
    }

    // Expose for ikimon_walk.php to read today's steps
    window._passiveStepTracker = {
        getTodaySteps: () => counter.getSteps(),
        getStoredData: load,
        isActive: () => counter.isActive
    };

    init();
})();

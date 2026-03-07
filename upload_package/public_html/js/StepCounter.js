/**
 * StepCounter — DeviceMotionEvent based pedometer
 * Uses accelerometer peak detection to count steps in real-time.
 * Works on iOS Safari (13+) and Android Chrome.
 */
class StepCounter {
    constructor() {
        this.steps = 0;
        this.isActive = false;
        this.permissionGranted = false;

        // Algorithm state
        this._filteredMag = 9.8; // gravity baseline
        this._lastStepTime = 0;
        this._aboveThreshold = false;

        // Tuning parameters
        this.THRESHOLD = 1.2;        // m/s² deviation from gravity to count
        this.MIN_STEP_INTERVAL = 250; // ms — max ~4 steps/sec (running)
        this.FILTER_ALPHA = 0.1;     // low-pass filter smoothing factor

        this._handleMotion = this._handleMotion.bind(this);
    }

    /**
     * Check if DeviceMotionEvent is available on this device.
     */
    static isSupported() {
        return typeof DeviceMotionEvent !== 'undefined';
    }

    /**
     * Request permission for motion sensors (required on iOS 13+).
     * Must be called from a user-gesture context (click/tap handler).
     * @returns {Promise<boolean>} true if permission granted or not needed
     */
    async requestPermission() {
        if (this.permissionGranted) return true;

        // iOS 13+ requires explicit permission request
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                const state = await DeviceMotionEvent.requestPermission();
                this.permissionGranted = (state === 'granted');
                return this.permissionGranted;
            } catch (e) {
                console.warn('[StepCounter] Permission request failed:', e);
                return false;
            }
        }

        // Android / older iOS — no permission needed
        this.permissionGranted = true;
        return true;
    }

    /**
     * Start listening to accelerometer data.
     */
    start() {
        if (this.isActive) return;
        if (!StepCounter.isSupported()) return;

        this.isActive = true;
        this._filteredMag = 9.8;
        this._aboveThreshold = false;
        window.addEventListener('devicemotion', this._handleMotion);
    }

    /**
     * Stop listening to accelerometer data.
     */
    stop() {
        if (!this.isActive) return;
        this.isActive = false;
        window.removeEventListener('devicemotion', this._handleMotion);
    }

    /**
     * Reset step count to zero.
     */
    reset() {
        this.steps = 0;
        this._lastStepTime = 0;
        this._aboveThreshold = false;
        this._filteredMag = 9.8;
    }

    /**
     * Get current step count.
     * @returns {number}
     */
    getSteps() {
        return this.steps;
    }

    /**
     * Set step count (for restoring from saved state).
     * @param {number} count
     */
    setSteps(count) {
        this.steps = count;
    }

    /**
     * Process a devicemotion event and detect steps via peak detection.
     * Algorithm: low-pass filter on acceleration magnitude,
     * detect threshold crossings (rising edge) with debounce.
     * @param {DeviceMotionEvent} event
     */
    _handleMotion(event) {
        const acc = event.accelerationIncludingGravity;
        if (!acc || acc.x === null) return;

        // Composite magnitude of acceleration
        const magnitude = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);

        // Low-pass filter to smooth out noise
        this._filteredMag = this._filteredMag * (1 - this.FILTER_ALPHA) + magnitude * this.FILTER_ALPHA;

        // Deviation from filtered baseline (approximate gravity removal)
        const deviation = Math.abs(magnitude - this._filteredMag);

        const now = Date.now();

        if (deviation > this.THRESHOLD) {
            if (!this._aboveThreshold) {
                this._aboveThreshold = true;
                // Debounce: enforce minimum interval between steps
                if (now - this._lastStepTime >= this.MIN_STEP_INTERVAL) {
                    this.steps++;
                    this._lastStepTime = now;
                }
            }
        } else {
            this._aboveThreshold = false;
        }
    }
}

const puppeteer = require('puppeteer');
const fs = require('fs');

const BASE_URL = 'http://localhost:8899';
const ARTIFACT_DIR = 'C:\\Users\\YAMAKI\\.gemini\\antigravity\\brain\\02fec538-4e0c-4324-bf55-9440ea6c139b';

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
    console.log("🚀 [ikimonWalk] Starting Virtual Field Test Simulator...");
    const browser = await puppeteer.launch({
        headless: "new",
        defaultViewport: { width: 390, height: 844 }, // Mobile Viewport (iPhone 12 Pro)
        args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
        ]
    });

    const page = await browser.newPage();
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(BASE_URL, ['geolocation']);

    const client = await page.currentTarget().createCDPSession();

    try {
        // --- 1. Authenticaton Phase ---
        console.log("🔑 Injecting test session...");
        await page.goto(`${BASE_URL}/api/test_auto_login.php`);
        await delay(500);

        // --- 2. Start Scenario 1: Warp Test ---
        console.log("🏃‍♂️ [Scenario 1] High-Speed GPS Mocking (Warp test)");
        await page.goto(`${BASE_URL}/field_research.php`, { waitUntil: 'networkidle0' });

        // Initial Location (Shizuoka Station)
        let lat = 34.9715;
        let lng = 138.3888;
        await client.send('Emulation.setGeolocationOverride', { latitude: lat, longitude: lng, accuracy: 10 });
        await delay(2000);

        // Take initial screenshot
        await page.screenshot({ path: `${ARTIFACT_DIR}/vtest_01_ready.png` });

        // Start recording
        console.log("  ▶ Pressing REC button...");
        await page.click('#btn-record');
        await delay(1000);
        await page.screenshot({ path: `${ARTIFACT_DIR}/vtest_02_recording.png` });

        // Simulate fast movement (10 points, moving rapidly east)
        console.log("  🚅 Simulating movement...");
        for (let i = 0; i < 10; i++) {
            lat += 0.0005; // Roughly 55m
            lng += 0.0010; // Roughly 90m
            await client.send('Emulation.setGeolocationOverride', { latitude: lat, longitude: lng, accuracy: 5 });
            await delay(1000); // 1 sec per move interval
        }

        await page.screenshot({ path: `${ARTIFACT_DIR}/vtest_03_moved.png` });

        // --- 3. Scenario 2: Network Drop & Recovery ---
        console.log("📶 [Scenario 2] Offline Network Drop (Tunnel test)");

        // Emulate Offline Mode
        await client.send('Network.emulateNetworkConditions', {
            offline: true,
            latency: 0,
            downloadThroughput: 0,
            uploadThroughput: 0
        });

        // Use page.evaluate to simulate offline event just in case
        await page.evaluate(() => window.dispatchEvent(new Event('offline')));
        console.log("  🛑 Network goes OFFLINE...");
        await delay(2000);
        await page.screenshot({ path: `${ARTIFACT_DIR}/vtest_04_offline.png` });

        // Walk while offline
        console.log("  👣 Walking while offline (Queueing data)...");
        for (let i = 0; i < 5; i++) {
            lat += 0.0005;
            lng += 0.0010;
            await client.send('Emulation.setGeolocationOverride', { latitude: lat, longitude: lng, accuracy: 5 });
            await delay(1000);
        }
        await page.screenshot({ path: `${ARTIFACT_DIR}/vtest_05_offline_walk.png` });

        // Emulate Online Mode
        console.log("  🔋 Network RESTORED! Triggering sync...");
        await client.send('Network.emulateNetworkConditions', {
            offline: false,
            latency: 0,
            downloadThroughput: -1,
            uploadThroughput: -1
        });
        await page.evaluate(() => window.dispatchEvent(new Event('online')));

        // Wait for IndexedDB sync to clear
        await delay(5000);
        await page.screenshot({ path: `${ARTIFACT_DIR}/vtest_06_synced.png` });

        // Stop recording
        console.log("  ⏹ Stopping recording...");
        await page.click('#btn-record');
        await delay(2000);

        // Verify Replay
        console.log("  🔄 Opening Replay panel...");
        await page.click('#btn-replay');
        await delay(2000);
        await page.screenshot({ path: `${ARTIFACT_DIR}/vtest_07_replay.png` });

        console.log("✅ Virtual Field Test Completed Successfully!");

    } catch (err) {
        console.error("❌ Test failed:", err);
    } finally {
        await browser.close();

        // Cleanup the temporary script
        if (fs.existsSync('../upload_package/public_html/api/test_auto_login.php')) {
            fs.unlinkSync('../upload_package/public_html/api/test_auto_login.php');
            console.log("🧹 Cleaned up temporary login script.");
        }
    }
})();

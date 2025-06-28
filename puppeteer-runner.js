import puppeteer from 'puppeteer';

const launchBrowser = async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    // executablePath: puppeteer.executablePath(), // Skip this line if Chrome/Chromium is available globally, or update the path to match your local Chrome/Chromium installation.
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--enable-webgl',
      '--ignore-certificate-errors',
      '--allow-insecure-localhost',
      '--enable-features=WebRTC-HW-Decoding,WebRTC-HW-Encoding',
    ],
    defaultViewport: null,
    userDataDir: './puppeteer-profile',
  });

  const page = await browser.newPage();

  page.on('console', msg => console.log('[PAGE]', msg.text()));
  page.on('error', err => console.error('[PAGE ERROR]', err));
  page.on('pageerror', err => console.error('[PAGE EXCEPTION]', err));

  await page.goto('https://cloudatlas.club/', { waitUntil: 'networkidle0' });
  console.log('✅ App loaded in headless browser');

  return { browser };
};

const runLoop = async () => {
  while (true) {
    let browser = null;
    try {
      console.log('🔁 Starting new Puppeteer session...');
      const result = await launchBrowser();
      browser = result.browser;

      // Wait for 5 minutes or until crash
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, 5 * 60 * 1000);
        browser.on('disconnected', () => {
          clearTimeout(timeout);
          reject(new Error('Browser disconnected unexpectedly'));
        });
      });

      console.log('🧹 5 minutes passed, closing browser...');
    } catch (err) {
      console.error('💥 Error during session:', err.message);
    } finally {
      if (browser && browser.isConnected()) {
        try {
          await browser.close();
        } catch (err) {
          console.warn('⚠️ Error closing browser:', err.message);
        }
      }
      console.log('🔄 Restarting session...');
    }
  }
};

runLoop();

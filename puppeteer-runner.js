import puppeteer from 'puppeteer';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const serveDist = async () => {
  const server = createServer(async (req, res) => {
    const filePath = req.url === '/' ? '/index.html' : req.url;

    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.wasm': 'application/wasm',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
    };

    try {
      const fullPath = path.join(__dirname, filePath);
      const file = await readFile(fullPath);
      const ext = path.extname(filePath);
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(file);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  return new Promise((resolve) => {
    server.listen(3000, '0.0.0.0', () => {
      console.log('🚀 Local server running at http://0.0.0.0:3000');
      resolve(server);
    });
  });
};

const launchBrowser = async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
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
    userDataDir: path.join(__dirname, 'puppeteer-profile'),
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
  await serveDist();

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

// usage: node shoot.js frames t1,t2,...   -> writes f_<t>.jpg
//        node shoot.js scene <start> <end> <out.mp4>
const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const fs = require('fs');
(async () => {
  const [mode, a, b, out] = process.argv.slice(2);
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
  await page.goto('file://' + __dirname + '/' + (process.env.PAGE || 'video.html'), { waitUntil: 'load' });
  if (mode === 'frames') {
    for (const t of a.split(',').map(Number)) {
      await page.evaluate(t => render(t), t);
      await page.screenshot({ path: `f_${t}.jpg`, type: 'jpeg', quality: 92 });
    }
  } else {
    const s = Number(a), e = Number(b), fps = 30;
    const tmp = out.replace(/\.mp4$/, '.part.mp4');
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', String(fps), tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
    const n = Math.round((e - s) * fps);
    for (let i = 0; i < n; i++) {
      await page.evaluate(t => render(t), s + i / fps);
      const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    const code = await new Promise(r => ff.on('close', r));
    if (code === 0) fs.renameSync(tmp, out); else { console.error('ffmpeg failed', code); process.exitCode = 1; }
  }
  await browser.close();
})();

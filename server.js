const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security headers (AdSense 호환) ──
app.use(helmet({
  contentSecurityPolicy: false,   // AdSense 스크립트 허용
  crossOriginEmbedderPolicy: false,
}));

// ── Gzip 압축 (성능 최적화) ──
app.use(compression());

// ── 캐시 설정 ──
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag: true,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// ── SPA fallback ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── 서버 시작 ──
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║     🚀 VOID BREAKER 서버 실행 중      ║
  ║                                       ║
  ║   http://localhost:${PORT}               ║
  ║                                       ║
  ║   Ctrl+C 로 서버 종료                  ║
  ╚═══════════════════════════════════════╝
  `);
});

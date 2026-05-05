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

// ── 캐시 설정 & 정적 파일 제공 ──
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag: true,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  }
}));

// Vercel Serverless 환경에서 express.static 경로 매핑이 누락되는 현상 방지를 위한 명시적 라우팅
app.get('/ads.txt', (req, res) => res.sendFile(path.join(__dirname, 'public', 'ads.txt')));
app.get('/robots.txt', (req, res) => res.sendFile(path.join(__dirname, 'public', 'robots.txt')));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'public', 'style.css')));
app.get('/game.js', (req, res) => res.sendFile(path.join(__dirname, 'public', 'game.js')));

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

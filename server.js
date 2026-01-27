const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

const videoDir = path.join(__dirname, 'videos');
const PASSCODE = '157514';

// 静的ファイル（動画）を提供
app.use('/videos', express.static(videoDir));

// トップページ：パスコード入力＋動画表示（すべてクライアントで制御）
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          margin: 0;
          padding: 0;
          background: #111;
          color: white;
          font-family: sans-serif;
        }
        #login, #viewer {
          display: none;
        }
        #video-container {
          display: flex;
          overflow-x: auto;
          white-space: nowrap;
          padding: 0;
          gap: 8px;
        }
        video {
          width: 300px;
          height: auto;
          flex-shrink: 0;
          background: #000;
        }
      </style>
    </head>
    <body>
      <div id="login" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;">
        <p>パスコードを入力してください：</p>
        <input type="password" id="passcode" placeholder="パスコード" style="padding:8px;font-size:16px;">
        <button onclick="checkPass()" style="padding:8px 12px;font-size:16px;margin-top:8px;">送信</button>
        <p id="error" style="color: red; margin-top: 10px;"></p>
      </div>

      <div id="viewer">
        <div id="video-container"></div>
      </div>

      <script>
        const CORRECT_PASS = '${PASSCODE}';
        let page = 1;
        let loading = false;

        function checkPass() {
          const input = document.getElementById('passcode').value;
          const error = document.getElementById('error');
          if (input === CORRECT_PASS) {
            document.getElementById('login').style.display = 'none';
            document.getElementById('viewer').style.display = 'block';
            loadVideos();
          } else {
            error.textContent = 'パスコードが違います';
          }
        }

        async function loadVideos() {
          if (loading) return;
          loading = true;

          const res = await fetch('/api/videos?page=' + page + '&pass=' + CORRECT_PASS);
          const data = await res.json();

          const container = document.getElementById('video-container');
          data.videos.forEach(src => {
            const video = document.createElement('video');
            video.src = src;
            video.controls = true;
            container.appendChild(video);
          });

          if (data.videos.length > 0) {
            page++;
          }

          loading = false;
        }

        document.addEventListener('DOMContentLoaded', () => {
          document.getElementById('login').style.display = 'flex';
        });

        document.getElementById('video-container').addEventListener('scroll', (e) => {
          const el = e.target;
          if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 10) {
            loadVideos();
          }
        });
      </script>
    </body>
    </html>
  `);
});

// 動画API（パスコード必須）
app.get('/api/videos', (req, res) => {
  const pass = req.query.pass;
  if (pass !== PASSCODE) {
    return res.status(403).json({ error: 'パスコードが違います' });
  }

  const page = parseInt(req.query.page) || 1;
  const pageSize = 3;

  fs.readdir(videoDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: '動画の読み込みに失敗しました' });
    }

    const videoFiles = files
      .filter(file => file.endsWith('.mp4'))
      .sort();

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginated = videoFiles.slice(start, end).map(file => `/videos/${file}`);

    res.json({ videos: paginated });
  });
});

app.listen(PORT, () => {
  console.log(`🔐 サーバーが http://localhost:\${PORT} で起動中`);
});

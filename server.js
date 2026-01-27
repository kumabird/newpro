const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

const videoDir = path.join(__dirname, 'videos');
const PASSCODE = '157514';

// パスコードチェック用ミドルウェア
function checkPass(req, res, next) {
  const pass = req.query.pass;
  if (pass !== PASSCODE) {
    return res.status(403).send('アクセス拒否：正しいパスコードを指定してください');
  }
  next();
}

// 静的ファイル（動画）を提供
app.use('/videos', express.static(videoDir));

// トップページ（動画ビューア）
app.get('/', checkPass, (req, res) => {
  const passParam = `?pass=${PASSCODE}`;
  res.send(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          margin: 0;
          padding: 0;
          overflow-x: hidden;
          background: #000;
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
      <div id="video-container"></div>
      <script>
        let page = 1;
        let loading = false;

        async function loadVideos() {
          if (loading) return;
          loading = true;

          const res = await fetch('/api/videos?page=' + page + '${passParam}');
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

        loadVideos();

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
app.get('/api/videos', checkPass, (req, res) => {
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
  console.log(`サーバがhttp://localhost:${PORT}/?pass=${PASSCODE} で起動中`);
});

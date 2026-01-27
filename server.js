const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

// 動画フォルダのパス
const videoDir = path.join(__dirname, 'videos');

// 静的ファイル（動画）を提供
app.use('/videos', express.static(videoDir));

// HTMLを返す
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <title>動画ギャラリー</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          overflow-x: hidden;
          font-family: sans-serif;
        }
        #video-container {
          display: flex;
          overflow-x: auto;
          white-space: nowrap;
          padding: 20px;
          gap: 10px;
        }
        video {
          width: 300px;
          height: auto;
          flex-shrink: 0;
        }
      </style>
    </head>
    <body>
      <h1 style="text-align:center;">🍄 動画ギャラリー</h1>
      <div id="video-container"></div>

      <script>
        let page = 1;
        let loading = false;

        async function loadVideos() {
          if (loading) return;
          loading = true;

          const res = await fetch('/api/videos?page=' + page);
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

// 動画一覧をページごとに返すAPI
app.get('/api/videos', (req, res) => {
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
  console.log(`🌟 サーバーが http://localhost:${PORT} で起動中`);
});

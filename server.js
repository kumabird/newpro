const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

const videoDir = path.join(__dirname, 'videos');
const PASSCODE = '157514';

// YouTube動画のリスト
const youtubeVideos = [
  { title: 'ネイチャー映像', url: 'https://www.youtube.com/embed/ScMzIvxBSi4' },
  { title: '音楽ライブ', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ' }
];

app.use('/videos', express.static(videoDir));

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <style>
        body { background: #111; color: white; font-family: sans-serif; margin: 0; padding: 0; }
        #login, #viewer { display: none; }
        #video-container { display: flex; flex-wrap: wrap; gap: 16px; padding: 16px; }
        video, iframe { width: 300px; height: 180px; background: #000; }
        #search-bar { margin: 16px; }
        input, button { font-size: 16px; padding: 8px; }
      </style>
    </head>
    <body>
      <div id="login" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;">
        <p>パスコードを入力してください：</p>
        <input type="password" id="passcode" placeholder="パスコード">
        <button onclick="checkPass()">送信</button>
        <p id="error" style="color: red;"></p>
      </div>

      <div id="viewer">
        <div id="search-bar">
          <input type="text" id="search" placeholder="動画名やキーワードで検索">
          <button onclick="startSearch()">検索</button>
        </div>
        <div id="video-container"></div>
      </div>

      <script>
        const CORRECT_PASS = '${PASSCODE}';
        let page = 1;
        let loading = false;
        let currentKeyword = '';

        function checkPass() {
          const input = document.getElementById('passcode').value;
          if (input === CORRECT_PASS) {
            document.getElementById('login').style.display = 'none';
            document.getElementById('viewer').style.display = 'block';
            loadVideos();
          } else {
            document.getElementById('error').textContent = 'パスコードが違います';
          }
        }

        function startSearch() {
          page = 1;
          currentKeyword = document.getElementById('search').value.trim();
          document.getElementById('video-container').innerHTML = '';
          loadVideos();
        }

        async function loadVideos() {
          if (loading) return;
          loading = true;
          try {
            const res = await fetch(\`/api/videos?page=\${page}&pass=\${CORRECT_PASS}&keyword=\${encodeURIComponent(currentKeyword)}\`);
            const data = await res.json();
            const container = document.getElementById('video-container');

            data.videos.forEach(src => {
              const video = document.createElement('video');
              video.src = src;
              video.controls = true;
              container.appendChild(video);
            });

            data.youtube.forEach(item => {
              const iframe = document.createElement('iframe');
              iframe.src = item.url;
              iframe.allowFullscreen = true;
              iframe.title = item.title;
              container.appendChild(iframe);
            });

            if (data.videos.length > 0 || data.youtube.length > 0) page++;
          } catch (err) {
            console.error('読み込み失敗', err);
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

app.get('/api/videos', (req, res) => {
  const pass = req.query.pass;
  const keyword = req.query.keyword || '';
  if (pass !== PASSCODE) {
    return res.status(403).json({ error: 'パスコードが違います' });
  }

  const page = parseInt(req.query.page) || 1;
  const pageSize = 3;

  let videoFiles = [];

  if (fs.existsSync(videoDir)) {
    try {
      const files = fs.readdirSync(videoDir);
      videoFiles = files
        .filter(file => file.endsWith('.mp4') && file.includes(keyword))
        .sort();
    } catch (err) {
      return res.status(500).json({ error: '動画の読み込みに失敗しました' });
    }
  }

  const start = (page - 1) * pageSize;
  const paginated = videoFiles.slice(start, start + pageSize).map(file => `/videos/${file}`);

  const filteredYouTube = youtubeVideos.filter(v => v.title.includes(keyword));

  res.json({ videos: paginated, youtube: filteredYouTube });
});

app.listen(PORT, () => {
  console.log(`🔐 http://localhost:${PORT} でサーバー起動中`);
});

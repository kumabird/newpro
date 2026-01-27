import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_CODE = "157514";

app.use(express.urlencoded({ extended: true }));

// 🔐 認証ミドルウェア
app.use((req, res, next) => {
  const allowed = ["/login", "/auth"];
  if (allowed.includes(req.path)) return next();
  if (req.query.auth === "1") return next();
  res.redirect("/login");
});

// 🔑 認証ページ
app.get("/login", (req, res) => {
  res.send(`
    <h2>認証コードを入力してください</h2>
    <form method="POST" action="/auth">
      <input type="password" name="code" placeholder="認証コード">
      <button type="submit">送信</button>
    </form>
  `);
});

// 🔑 認証処理
app.post("/auth", (req, res) => {
  const code = req.body.code;
  if (code === AUTH_CODE) {
    res.redirect("/?auth=1");
  } else {
    res.send("<h3>認証コードが違います</h3><a href='/login'>戻る</a>");
  }
});

// 🏠 ホーム
app.get("/", (req, res) => {
  res.send(`
    <h2>YouTube Viewer（API不要）</h2>
    <form action="/search">
      <input type="hidden" name="auth" value="1">
      <input type="text" name="q" placeholder="検索ワードを入力" style="width:300px;">
      <button type="submit">検索</button>
    </form>
  `);
});

// 🔍 検索結果（3列・最大51本）
app.get("/search", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.send("検索ワードがありません");

  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
  const html = await fetch(url).then(r => r.text());

  const matches = [...html.matchAll(/"videoId":"(.*?)".*?"title":\{"runs":\[\{"text":"(.*?)"\}\]\}/gs)];
  const videos = matches.slice(0, 51).map(m => ({ id: m[1], title: m[2] }));

  let list = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>検索結果</title>
    <style>
      body {
        font-family: sans-serif;
        padding: 20px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 20px;
      }
      .grid img {
        width: 100%;
        border-radius: 8px;
      }
      .title {
        margin-top: 5px;
        font-weight: bold;
      }
    </style>
  </head>
  <body>
    <h2>検索結果: ${q}</h2>
    <div class="grid">
  `;

  list += videos.map(v => `
      <div>
        <a href="/watch?v=${v.id}&auth=1">
          <img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg">
          <div class="title">${v.title}</div>
        </a>
      </div>
  `).join("");

  list += `
    </div>
    <br><a href='/?auth=1'>戻る</a>
  </body>
  </html>
  `;

  res.send(list);
});

// ▶️ 動画再生（レスポンシブ対応）
app.get("/watch", (req, res) => {
  const id = req.query.v;
  if (!id) return res.send("動画IDがありません");

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>動画再生</title>
      <style>
        body {
          font-family: sans-serif;
          padding: 20px;
        }
        .video-container {
          position: relative;
          padding-bottom: 56.25%;
          height: 0;
          overflow: hidden;
          max-width: 100%;
        }
        .video-container iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border: 0;
        }
      </style>
    </head>
    <body>
      <h2>動画再生</h2>
      <div class="video-container">
        <iframe src="https://www.youtube.com/embed/${id}" allowfullscreen></iframe>
      </div>
      <br><br><a href='/?auth=1'>ホーム</a>
    </body>
    </html>
  `);
});

// 📺 チャンネル動画一覧（3列・最大51本）
app.get("/channel", async (req, res) => {
  const id = req.query.id;
  if (!id) return res.send("チャンネルIDがありません");

  const url = `https://www.youtube.com/channel/${id}/videos`;
  const html = await fetch(url).then(r => r.text());

  const matches = [...html.matchAll(/"videoId":"(.*?)".*?"title":\{"runs":\[\{"text":"(.*?)"\}\]\}/gs)];
  const videos = matches.slice(0, 51).map(m => ({ id: m[1], title: m[2] }));

  let list = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>チャンネル動画一覧</title>
    <style>
      body {
        font-family: sans-serif;
        padding: 20px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 20px;
      }
      .grid img {
        width: 100%;
        border-radius: 8px;
      }
      .title {
        margin-top: 5px;
        font-weight: bold;
      }
    </style>
  </head>
  <body>
    <h2>チャンネル動画一覧</h2>
    <div class="grid">
  `;

  list += videos.map(v => `
      <div>
        <a href="/watch?v=${v.id}&auth=1">
          <img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg">
          <div class="title">${v.title}</div>
        </a>
      </div>
  `).join("");

  list += `
    </div>
    <br><a href='/?auth=1'>戻る</a>
  </body>
  </html>
  `;

  res.send(list);
});

app.listen(PORT, () => console.log(`🌊 Server running at http://localhost:${PORT}`));

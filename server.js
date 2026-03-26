import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import cookieParser from "cookie-parser";

const app = express();
app.disable("x-powered-by");

const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// PostgreSQL 接続
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --------------------------------------
// 共通CSS
// --------------------------------------
const CSS = `
<style>
  body {
    font-family: "Segoe UI", sans-serif;
    background: #f0f6ff;
    margin: 0;
    padding: 0;
    color: #333;
  }

  h2 {
    margin-bottom: 20px;
    color: #2c3e50;
    text-align: center;
  }

  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    width: 50px;
    height: 100%;
    background: white;
    border-right: 1px solid #ddd;
    padding-top: 60px;
    transition: width 0.25s ease;
    overflow: hidden;
    z-index: 1000;
  }

  .sidebar.open {
    width: 220px;
  }

  .sidebar a {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 18px;
    font-size: 17px;
    color: #333;
    text-decoration: none;
    white-space: nowrap;
  }

  .sidebar a:hover {
    background: #eaf4ff;
  }

  .sidebar-icon {
    font-size: 20px;
  }

  .main-content {
    margin-left: 80px;
    padding: 20px;
    transition: margin-left 0.25s ease;
  }

  .main-content.shift {
    margin-left: 240px;
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 20px;
    padding: 20px;
  }

  .card {
    background: white;
    padding: 15px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    transition: transform 0.25s ease, box-shadow 0.25s ease;
  }

  .card:hover {
    transform: translateY(-4px);
    box-shadow: 0 6px 16px rgba(0,0,0,0.15);
  }

  .thumb {
    width: 100%;
    border-radius: 10px;
  }

  .center-box {
    max-width: 380px;
    margin: 80px auto;
    background: white;
    padding: 30px;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  }

  input, button {
    width: 100%;
    padding: 12px 14px;
    font-size: 16px;
    border-radius: 8px;
    border: 1px solid #ccc;
    margin-bottom: 15px;
  }

  button {
    background: #3498db;
    color: white;
    border: none;
    cursor: pointer;
    font-weight: bold;
  }

  button:hover {
    background: #2d89c6;
  }

  .region-select {
    width: 100%;
    padding: 12px 14px;
    font-size: 16px;
    border-radius: 8px;
    border: 1px solid #ccc;
    margin-bottom: 15px;
    background: white;
    cursor: pointer;
  }

  .region-select:hover {
    border-color: #3498db;
  }
</style>
`;

// --------------------------------------
// サイドバー HTML
// --------------------------------------
const SIDEBAR_HTML = `
<div id="sidebar" class="sidebar">
  <a href="/"><span class="sidebar-icon">🏠</span> <span class="sidebar-text">ホーム</span></a>
  <a href="/channel-search"><span class="sidebar-icon">📺</span> <span class="sidebar-text">チャンネル検索</span></a>
  <a href="/music"><span class="sidebar-icon">♫</span> <span class="sidebar-text">Music</span></a>
  <a href="/history"><span class="sidebar-icon">🕘</span> <span class="sidebar-text">履歴</span></a>
  <a href="/admin"><span class="sidebar-icon">⚙️</span> <span class="sidebar-text">管理者ページ</span></a>
  <a href="/logout"><span class="sidebar-icon">🚪</span> <span class="sidebar-text">ログアウト</span></a>
</div>
`;

// --------------------------------------
// サイドバー JS
// --------------------------------------
const SIDEBAR_JS = `
<script>
const sidebar = document.getElementById("sidebar");
const main = document.getElementById("main-content");

sidebar.addEventListener("mouseenter", () => {
  sidebar.classList.add("open");
  main.classList.add("shift");
});

sidebar.addEventListener("mouseleave", () => {
  sidebar.classList.remove("open");
  main.classList.remove("shift");
});
</script>
`;

// --------------------------------------
// ユーザー管理
// --------------------------------------
function loadUsers() {
  if (!fs.existsSync("users.json")) return [];
  return JSON.parse(fs.readFileSync("users.json", "utf8"));
}

async function saveHistory(user, keyword, videoId, title) {
  try {
    await pool.query(
      "INSERT INTO history (user_id, query, video_id, title) VALUES ($1, $2, $3, $4)",
      [user, keyword, videoId, title]
    );
  } catch (err) {
    console.error("履歴保存エラー(history):", err);
  }
  try {
    await pool.query(
      "INSERT INTO admin_history (user_id, query, video_id, title) VALUES ($1, $2, $3, $4)",
      [user, keyword, videoId, title]
    );
  } catch (err) {
    console.error("履歴保存エラー(admin_history):", err);
  }
}

function formatDateJP(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  const weekdays = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];
  const weekday = weekdays[d.getDay()];
  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds} (${weekday})`;
}

// --------------------------------------
// ログイン
// --------------------------------------
app.get("/login", (req, res) => {
  res.send(`
    <html>
    <head>${CSS}</head>
    <body>
      <div class="center-box">
        <h2>ログイン</h2>
        <form method="POST" action="/login">
          <input name="user" placeholder="ユーザー名" required>
          <input name="pass" type="password" placeholder="パスワード" required>
          <button>ログイン</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

app.post("/login", (req, res) => {
  const { user, pass } = req.body;
  const users = loadUsers();
  const found = users.find(u => u.user === user && u.pass === pass);
  if (!found) return res.send("ユーザー名またはパスワードが違います");
  res.cookie("user", user, { httpOnly: true });
  res.redirect("/");
});

// --------------------------------------
// ホーム
// --------------------------------------
app.get("/", (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  res.send(`
    <html>
    <head>${CSS}</head>
    <body>
      ${SIDEBAR_HTML}
      <div id="main-content" class="main-content">
        <h2>動画検索</h2>
        <div style="max-width:800px;margin:0 auto;">
          <form action="/search" method="post">
            <input type="text" name="q" placeholder="検索ワードを入力">
            <select name="region" class="region-select">
              <option value="jp">日本のみ</option>
              <option value="global">全世界</option>
            </select>
            <button type="submit">動画を検索</button>
          </form>
        </div>
      </div>
      ${SIDEBAR_JS}
    </body>
    </html>
  `);
});

// --------------------------------------
// 動画検索（60件）
// --------------------------------------
app.post("/search", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  const q = req.body.q;
  const region = req.body.region || "jp";
  if (!q) return res.send("検索ワードがありません");

  let url;
  if (region === "global") {
    url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
  } else {
    url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&gl=JP&hl=ja`;
  }

  const html = await fetch(url).then(r => r.text());
  const videoMatches = [...html.matchAll(/"videoId":"(.*?)".*?"title":\{"runs":\[\{"text":"(.*?)"\}\]/gs)];
  const videos = videoMatches.slice(0, 60).map(m => ({ id: m[1], title: m[2] }));

  let list = `
    <html>
    <head>${CSS}</head>
    <body>
      ${SIDEBAR_HTML}
      <div id="main-content" class="main-content">
        <h2>動画検索結果: ${q}（${region === "jp" ? "日本" : "全世界"}）</h2>
        <div class="card-grid">
  `;

  list += videos.map(v => `
    <form action="/watch" method="post" style="display:inline;">
      <input type="hidden" name="id" value="${v.id}">
      <button style="all:unset;cursor:pointer;">
        <div class="card">
          <img class="thumb" src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg">
          <div style="margin-top:10px;font-weight:bold;">${v.title}</div>
        </div>
      </button>
    </form>
  `).join("");

  list += `
        </div>
      </div>
      ${SIDEBAR_JS}
    </body>
    </html>
  `;

  res.send(list);
});

// --------------------------------------
// Invidiousインスタンスリストを取得
// --------------------------------------
let invidiousApis = null;

async function getInvidiousApis() {
  try {
    const res = await fetch("https://raw.githubusercontent.com/wakame02/wktopu/refs/heads/main/inv.json");
    invidiousApis = await res.json();
    console.log("Invidiousリスト取得成功:", invidiousApis.length, "件");
  } catch (e) {
    console.error("Invidiousリスト取得失敗:", e);
  }
}

// サーバー起動時に取得
getInvidiousApis();

// --------------------------------------
// Invidiousから動画ストリームURLを取得
// --------------------------------------
async function getStreamUrl(videoId) {
  if (!invidiousApis) await getInvidiousApis();
  if (!invidiousApis) throw new Error("APIリストが取得できません");

  const controller = new AbortController();

  const promises = invidiousApis.map(instance =>
    fetch(`${instance}/api/v1/videos/${videoId}`, {
      signal: controller.signal
    })
    .then(res => res.ok ? res.json() : Promise.reject())
    .then(data => {
      if (!data.formatStreams) throw new Error("no stream");

      const streamUrl = data.formatStreams.slice().reverse()[0].url;

      const audioUrl = (data.adaptiveFormats || [])
        .filter(s => s.container === "m4a")
        .map(s => s.url)[0] || null;

      return {
        streamUrl,
        audioUrl,
        title: data.title || "タイトル不明",
        channelName: data.author || "",
        channelId: data.authorId || "",
        related: (data.recommendedVideos || []).slice(0, 20).map(v => ({
          id: v.videoId,
          title: v.title
        }))
      };
    })
    .catch(() => null)
  );

  try {
    const result = await Promise.any(promises);
    controller.abort(); // 他のリクエスト止める
    return result;
  } catch {
    throw new Error("全インスタンスで失敗しました");
  }
}
// --------------------------------------
// 動画視聴 + 関連動画（Invidious版）
// --------------------------------------
app.post("/watch", async (req, res) => {
  const id = req.body.id;
  if (!id) return res.send("動画IDがありません");
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) return res.send("動画IDが正しくありません");

  const user = req.cookies.user;

  let streamUrl, audioUrl, title, channelName, channelId, related;

  try {
    ({ streamUrl, audioUrl, title, channelName, channelId, related } = await getStreamUrl(id));
  } catch (e) {
    // 全インスタンス失敗時はYouTubeへリダイレクト
    return res.redirect(`https://www.youtube.com/watch?v=${id}`);
  }

  if (user) {
    saveHistory;(user, "watch", id, title).catch(console.error);
  }

  // 関連動画HTML
  const relatedHTML = related.length > 0
    ? related.map(v => `
        <form action="/watch" method="post" style="display:block;margin-bottom:12px;">
          <input type="hidden" name="id" value="${v.id}">
          <button style="all:unset;cursor:pointer;width:100%;">
            <div style="display:flex;gap:8px;align-items:flex-start;">
              <img src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg"
                   style="width:168px;height:94px;border-radius:8px;object-fit:cover;flex-shrink:0;">
              <div style="font-size:13px;font-weight:bold;line-height:1.4;color:#333;">
                ${v.title}
              </div>
            </div>
          </button>
        </form>
      `).join("")
    : `<p style="color:#999;font-size:13px;">関連動画を取得できませんでした</p>`;

  res.send(`
    <html>
    <head>
      ${CSS}
      <style>
        .watch-layout {
          display: flex;
          gap: 24px;
          max-width: 1280px;
          margin: 0 auto;
          padding: 20px;
          align-items: flex-start;
        }
        .watch-player {
          flex: 1;
          min-width: 0;
        }
        .watch-player video {
          width: 100%;
          aspect-ratio: 16/9;
          border-radius: 12px;
          background: #000;
        }
        .watch-related {
          width: 380px;
          flex-shrink: 0;
          max-height: 90vh;
          overflow-y: auto;
        }
        .watch-related h3 {
          font-size: 15px;
          margin-bottom: 12px;
          color: #2c3e50;
        }
        .channel-info {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 12px 0;
          font-size: 14px;
          color: #555;
        }
        @media (max-width: 900px) {
          .watch-layout { flex-direction: column; }
          .watch-related { width: 100%; }
        }
      </style>
    </head>
    <body>
      ${SIDEBAR_HTML}
      <div id="main-content" class="main-content">
        <div class="watch-layout">

          <!-- 左：プレイヤー -->
          <div class="watch-player">
            <h2 style="font-size:18px;margin-bottom:8px;">${title}</h2>
            <div class="channel-info">
              <a href="/channel-videos?id=${channelId}" style="color:#3498db;font-weight:bold;">
                📺 ${channelName}
              </a>
            </div>

            <!-- ★ iframeなし・直接再生 -->
            <video id="mainVideo" controls preload="auto" playsinline
                   poster="https://i.ytimg.com/vi/${id}/maxresdefault.jpg">
              <source id="videoSrc" src="${streamUrl}" type="video/mp4">
            </video>

            <div style="margin-top:12px;">
              <a href="/" style="color:#3498db;">← ホームへ戻る</a>
              &nbsp;|&nbsp;
              <a href="https://www.youtube.com/watch?v=${id}" target="_blank" style="color:#e74c3c;">
                YouTubeで開く
              </a>
            </div>
          </div>

          <!-- 右：関連動画 -->
          <div class="watch-related">
            <h3>関連動画</h3>
            ${relatedHTML}
          </div>

        </div>
      </div>
      ${SIDEBAR_JS}
    </body>
    </html>
  `);
});

// --------------------------------------
// チャンネル検索
// --------------------------------------
app.get("/channel-search", (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  res.send(`
    <html>
    <head>${CSS}</head>
    <body>
      ${SIDEBAR_HTML}
      <div id="main-content" class="main-content">
        <h2>チャンネル検索</h2>
        <div style="max-width:800px;margin:0 auto;">
          <form action="/channel-search/result" method="post">
            <input type="text" name="q" placeholder="チャンネル名を入力">
            <select name="region" class="region-select">
              <option value="jp">日本のみ</option>
              <option value="global">全世界</option>
            </select>
            <button type="submit">検索</button>
          </form>
        </div>
      </div>
      ${SIDEBAR_JS}
    </body>
    </html>
  `);
});

// --------------------------------------
// チャンネル検索結果（60件）
// --------------------------------------
app.post("/channel-search/result", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  const q = req.body.q;
  const region = req.query.region || "jp";

  let url;
  if (region === "global") {
    url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAg%253D%253D`;
  } else {
    url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAg%253D%253D&hl=ja&gl=JP`;
  }

  const html = await fetch(url).then(r => r.text());
  const jsonText = html.match(/var ytInitialData = (.*?);<\/script>/s);
  if (!jsonText) return res.send("データを取得できませんでした");

  const data = JSON.parse(jsonText[1]);
  const channels = [];

  function scan(obj) {
    if (typeof obj !== "object" || obj === null) return;
    if (obj.channelRenderer) {
      const c = obj.channelRenderer;
      channels.push({
        id: c.channelId,
        title: c.title?.simpleText || c.title?.runs?.[0]?.text || "No Title",
        icon: c.thumbnail?.thumbnails?.[0]?.url || ""
      });
    }
    for (const key in obj) scan(obj[key]);
  }
  scan(data);

  const list60 = channels.slice(0, 60);

  res.send(`
    <html>
    <head>${CSS}</head>
    <body>
      ${SIDEBAR_HTML}
      <div id="main-content" class="main-content">
        <h2>チャンネル検索結果: ${q}（${region === "jp" ? "日本" : "全世界"}）</h2>
        <div class="card-grid">
          ${list60.map(c => `
            <div class="card" onclick="location.href='/channel-videos?id=${c.id}'" style="cursor:pointer;">
              <img class="thumb" src="${c.icon}">
              <div style="margin-top:10px;font-weight:bold;">${c.title}</div>
            </div>
          `).join("")}
        </div>
      </div>
      ${SIDEBAR_JS}
    </body>
    </html>
  `);
});

// --------------------------------------
// チャンネル動画一覧
// --------------------------------------
app.get("/channel-videos", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  const id = req.query.id;
  if (!id) return res.send("チャンネルIDがありません");

  const url = `https://www.youtube.com/channel/${id}/videos?hl=ja&gl=JP`;
  const html = await fetch(url).then(r => r.text());

  let jsonText =
    html.match(/ytInitialData"\]\s*=\s*(\{.*?\});/) ||
    html.match(/var ytInitialData = (\{.*?\});/) ||
    html.match(/window\["ytInitialData"\]\s*=\s*(\{.*?\});/);

  if (!jsonText) return res.send("データを取得できませんでした");

  const data = JSON.parse(jsonText[1]);

  function findGridItems(obj) {
    if (!obj || typeof obj !== "object") return null;
    if (obj.gridRenderer?.items) return obj.gridRenderer.items;
    if (obj.richGridRenderer?.contents) return obj.richGridRenderer.contents;
    for (const key in obj) {
      const found = findGridItems(obj[key]);
      if (found) return found;
    }
    return null;
  }

  const grid = findGridItems(data) || [];
  const videos = grid
    .map(v => v.gridVideoRenderer || v.richItemRenderer?.content?.videoRenderer)
    .filter(v => v && v.videoId)
    .map(v => ({
      id: v.videoId,
      title:
        v.title?.simpleText ||
        v.title?.runs?.map(r => r.text).join("") ||
        "No Title"
    }));

  const list60 = videos.slice(0, 60);
  const channelTitle = data.metadata?.channelMetadataRenderer?.title || "チャンネル名取得不可";

  let list = `
    <html>
    <head>${CSS}</head>
    <body>
      ${SIDEBAR_HTML}
      <div id="main-content" class="main-content">
        <h2>${channelTitle} の動画一覧</h2>
        <div class="card-grid">
  `;

  list += list60.map(v => `
    <div class="card">
      <form action="/watch" method="post" style="display:inline;">
        <input type="hidden" name="id" value="${v.id}">
        <button style="all:unset;cursor:pointer;">
          <img class="thumb" src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg">
          <div style="margin-top:10px;font-weight:bold;">${v.title}</div>
        </button>
      </form>
    </div>
  `).join("");

  list += `
        </div>
      </div>
      ${SIDEBAR_JS}
    </body>
    </html>
  `;

  res.send(list);
});

// --------------------------------------
// 履歴ページ
// --------------------------------------
app.get("/history", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  const result = await pool.query(
    `SELECT query, video_id, title, created_at
     FROM history
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [user]
  );

  const data = result.rows;

  let html = `
    <html>
    <head>${CSS}</head>
    <body>
      ${SIDEBAR_HTML}
      <div id="main-content" class="main-content">
        <h2>${user} さんの視聴履歴</h2>
        <form action="/history/delete" method="POST">
          <button style="width:200px;background:#e74c3c;">履歴をすべて削除</button>
        </form>
        <br>
  `;

  html += data.map(item => `
    <div class="card" style="margin-bottom:12px;display:flex;gap:12px;align-items:center;">
      <img src="https://i.ytimg.com/vi/${item.video_id}/mqdefault.jpg"
           style="width:120px;height:68px;border-radius:8px;object-fit:cover;flex-shrink:0;">
      <div>
        <div style="font-size:12px;color:#999;">${formatDateJP(item.created_at)}</div>
        <a href="#" onclick="postWatch('${item.video_id}')" style="font-weight:bold;color:#2c3e50;">
          ${item.title}
        </a>
      </div>
    </div>
  `).join("");

  html += `
        <br><center><a href="/">ホームへ戻る</a></center>
      </div>
      ${SIDEBAR_JS}
      <script>
      function postWatch(id) {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = "/watch";
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = "id";
        input.value = id;
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
      }
      </script>
    </body>
    </html>
  `;

  res.send(html);
});

// --------------------------------------
// 履歴削除（全削除）
// --------------------------------------
app.post("/history/delete", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  await pool.query("DELETE FROM history WHERE user_id = $1", [user]);
  res.redirect("/history");
});

// --------------------------------------
// 管理者ページ
// --------------------------------------
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme";

app.get("/admin", (req, res) => {
  const user = req.cookies.user;
  const pass = req.query.pass;

  if (!user) return res.redirect("/login");
  if (user !== "hinata") return res.send("あなたには管理者ページへのアクセス権がありません");

  if (pass !== ADMIN_PASSWORD) {
    return res.send(`
      <html>
      <head>${CSS}</head>
      <body>
        ${SIDEBAR_HTML}
        <div id="main-content" class="main-content">
          <div class="center-box">
            <h2>管理者ログイン</h2>
            <form>
              <input name="pass" type="password" placeholder="管理者パスワード" required>
              <button>ログイン</button>
            </form>
          </div>
        </div>
        ${SIDEBAR_JS}
      </body>
      </html>
    `);
  }

  res.send(`
    <form id="f" method="POST" action="/admin">
      <input type="hidden" name="pass" value="${ADMIN_PASSWORD}">
    </form>
    <script>document.getElementById("f").submit();</script>
  `);
});

app.post("/admin", async (req, res) => {
  const pass = req.body.pass;
  if (pass !== ADMIN_PASSWORD) return res.send("パスワードが違います");

  const result = await pool.query(
    `SELECT user_id, query, video_id, title, created_at FROM admin_history ORDER BY created_at DESC`
  );

  const historyByUser = {};
  for (const row of result.rows) {
    if (!historyByUser[row.user_id]) historyByUser[row.user_id] = [];
    historyByUser[row.user_id].push(row);
  }

  let allHistoryHTML = "";
  let deleteButtonsHTML = "";

  for (const userName in historyByUser) {
    const data = historyByUser[userName];
    allHistoryHTML += `<h3>${userName}</h3>`;
    allHistoryHTML += data.map(item => `
      <div class="card" style="margin-bottom:12px;display:flex;gap:12px;align-items:center;">
        <img src="https://i.ytimg.com/vi/${item.video_id}/mqdefault.jpg"
             style="width:120px;height:68px;border-radius:8px;object-fit:cover;flex-shrink:0;">
        <div>
          <div style="font-size:12px;color:#999;">${formatDateJP(item.created_at)}</div>
          <a href="#" onclick="postWatch('${item.video_id}')" style="font-weight:bold;color:#2c3e50;">
            ${item.title}
          </a>
        </div>
      </div>
    `).join("");

    deleteButtonsHTML += `
      <form method="POST" action="/admin/delete-user">
        <input type="hidden" name="user" value="${userName}">
        <input type="hidden" name="pass" value="${ADMIN_PASSWORD}">
        <button style="width:200px;background:#e74c3c;">${userName} の履歴を削除</button>
      </form>
      <br>
    `;
  }

  res.send(`
    <html>
    <head>
      ${CSS}
      <style>
        .tabs { display:flex; gap:8px; margin-bottom:20px; }
        .tab { padding:10px 20px; border-radius:8px; cursor:pointer; background:#eee; font-weight:bold; }
        .tab.active { background:#3498db; color:white; }
        .tab-content { display:none; }
        .tab-content.active { display:block; }
      </style>
    </head>
    <body>
      ${SIDEBAR_HTML}
      <div id="main-content" class="main-content">
        <h2>管理者ページ</h2>
        <p style="color:#e74c3c;font-size:13px;text-align:center;">※ユーザーが自分の履歴を削除しても、この画面の記録は消えません</p>
        <div class="tabs">
          <div class="tab active" id="tab-all" onclick="openTab('all')">全履歴</div>
          <div class="tab" id="tab-delete" onclick="openTab('delete')">記録削除</div>
        </div>
        <div class="tab-content active" id="content-all">
          ${allHistoryHTML}
        </div>
        <div class="tab-content" id="content-delete">
          ${deleteButtonsHTML}
        </div>
        <script>
          function openTab(name) {
            document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
            document.getElementById("tab-" + name).classList.add("active");
            document.getElementById("content-" + name).classList.add("active");
          }
          function postWatch(id) {
            const form = document.createElement("form");
            form.method = "POST";
            form.action = "/watch";
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = "id";
            input.value = id;
            form.appendChild(input);
            document.body.appendChild(form);
            form.submit();
          }
        </script>
      </div>
      ${SIDEBAR_JS}
    </body>
    </html>
  `);
});

// --------------------------------------
// 管理者：ユーザー履歴削除
// --------------------------------------
app.post("/admin/delete-user", async (req, res) => {
  const pass = req.body.pass;
  const user = req.body.user;
  if (pass !== ADMIN_PASSWORD) return res.send("パスワードが違います");
  await pool.query("DELETE FROM admin_history WHERE user_id = $1", [user]);
  res.redirect(`/admin?pass=${ADMIN_PASSWORD}`);
});

// --------------------------------------
// ログアウト
// --------------------------------------
app.get("/logout", (req, res) => {
  res.clearCookie("user");
  res.redirect("/login");
});

// --------------------------------------
// ミュージック
// --------------------------------------
app.get("/music", (req, res) => {
  res.redirect("https://musicviewer.onrender.com/");
});

// --------------------------------------
// サーバー起動
// --------------------------------------
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

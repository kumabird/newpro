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
// 共通CSS（YouTube風サイドバー対応）
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

  /* サイドバー（閉じた状態） */
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

  /* 開いた状態 */
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

  /* メインコンテンツ */
  .main-content {
    margin-left: 80px;
    padding: 20px;
    transition: margin-left 0.25s ease;
  }

  .main-content.shift {
    margin-left: 240px;
  }

  /* カードレイアウト */
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

  /* ★ 地域選択 UI 統一デザイン ★ */
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
// サイドバー HTML（全ページ共通）
// --------------------------------------
const SIDEBAR_HTML = `
<div id="sidebar" class="sidebar">
  <a href="/"><span class="sidebar-icon">🏠</span> <span class="sidebar-text">ホーム</span></a>
  <a href="/channel-search"><span class="sidebar-icon">📺</span> <span class="sidebar-text">チャンネル検索</span></a>
  <a href="/shorts"><span class="sidebar-icon">📱</span> <span class="sidebar-text">Shorts</span></a>
  <a href="/music"><span class="sidebar-icon">♫</span> <span class="sidebar-text">Music</span></a>
  <a href="/history"><span class="sidebar-icon">🕘</span> <span class="sidebar-text">履歴</span></a>
  <a href="/admin"><span class="sidebar-icon">⚙️</span> <span class="sidebar-text">管理者ページ</span></a>
  <a href="/logout"><span class="sidebar-icon">🚪</span> <span class="sidebar-text">ログアウト</span></a>
</div>
`;

// --------------------------------------
// ホーム（動画検索のみ・横幅広 UI）
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
// サイドバー JS（ホバーで開閉）
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
// Invidious経由 動画ストリームURL取得
// --------------------------------------
let invidiousApis = null;
const INV_JSON_URL = "https://raw.githubusercontent.com/wakame02/wktopu/refs/heads/main/inv.json";
const INV_TIMEOUT = 4000;

async function loadInvidiousApis() {
  try {
    const res = await fetch(INV_JSON_URL);
    invidiousApis = await res.json();
    console.log("Invidious APIリストを取得しました");
  } catch (e) {
    console.error("Invidious APIリスト取得失敗:", e.message);
  }
}
loadInvidiousApis();

async function getStreamUrl(videoId) {
  if (!invidiousApis) await loadInvidiousApis();
  if (!invidiousApis) throw new Error("APIリストを取得できません");

  for (const instance of invidiousApis) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), INV_TIMEOUT);
      const res = await fetch(`${instance}/api/v1/videos/${videoId}`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();

      if (!data.formatStreams) continue;

      // 通常ストリーム（音声付き）
      const streamUrl = [...data.formatStreams].reverse().map(s => s.url)[0];
      // 音声のみ（m4a）
      const audioUrl = (data.adaptiveFormats || [])
        .filter(s => s.container === "m4a" && s.audioQuality === "AUDIO_QUALITY_MEDIUM")
        .map(s => s.url)[0];
      // 高画質ストリーム（映像のみ webm）
      const videoStreams = (data.adaptiveFormats || [])
        .filter(s => s.container === "webm" && s.resolution)
        .map(s => ({ url: s.url, resolution: s.resolution }));

      return { streamUrl, audioUrl, videoStreams, title: data.title || "" };
    } catch (e) {
      console.error(`Invidious ${instance} エラー:`, e.message);
    }
  }
  throw new Error("すべてのInvidiousインスタンスで取得に失敗しました");
}

// --------------------------------------
// 固定ユーザー管理
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
    console.error("履歴保存エラー:", err);
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
// ログイン画面
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
        <h2>ようこそ ${user} さん</h2>
        <center>
          <form action="/search">
            <input type="text" name="q" placeholder="検索ワード" required style="max-width:400px;">
            <button style="width:200px;">検索</button>
          </form>
          <br>
          <a href="/logout">ログアウト</a>
        </center>
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

  // ★ POST で受け取る（履歴に残らない）
  const q = req.body.q;
  const region = req.body.region || "jp";

  if (!q) return res.send("検索ワードがありません");

  // ★ 地域ごとに URL を切り替え
  let url;
  if (region === "global") {
    url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
  } else {
    url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&gl=JP&hl=ja`;
  }

  const html = await fetch(url).then(r => r.text());

  // ★ 正規表現は必ず1行（改行禁止）
  const videoMatches = [...html.matchAll(/"videoId":"(.*?)".*?"title":\{"runs":\[\{"text":"(.*?)"\}\]/gs)];

  const videos = videoMatches.slice(0, 60).map(m => ({
    id: m[1],
    title: m[2]
  }));

  // ★ HTML 出力
  let list = `
    <html>
    <head>${CSS}</head>
    <body>
      ${SIDEBAR_HTML}  

      <div id="main-content" class="main-content">
        <h2>動画検索結果: ${q}（${region === "jp" ? "日本" : "全世界"}）</h2>
        <div class="card-grid">
  `;

  // ★ 動画カード（POST 方式・履歴に残らない）
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
// チャンネル動画一覧（内部ページ）
// --------------------------------------
app.get("/channel-videos", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  const id = req.query.id;
  if (!id) return res.send("チャンネルIDがありません");

  // チャンネルの動画一覧ページを取得
  const url = `https://www.youtube.com/channel/${id}/videos?hl=ja&gl=JP`;
  const html = await fetch(url).then(r => r.text());

  // ytInitialData を抽出（複数パターン対応）
  let jsonText =
  html.match(/ytInitialData"\]\s*=\s*(\{.*?\});/) ||
  html.match(/var ytInitialData = (\{.*?\});/) ||
  html.match(/window\["ytInitialData"\]\s*=\s*(\{.*?\});/);

  if (!jsonText)
    return res.send("データを取得できませんでした（ytInitialData が見つかりません）");

  const data = JSON.parse(jsonText[1]);

function getTitle(v) {
  if (v.title?.simpleText) return v.title.simpleText;

  if (Array.isArray(v.title?.runs)) {
    return v.title.runs.map(r => r.text).join("") || "No Title";
  }

  return "No Title";
}
  
function findGridItems(obj) {
  if (!obj || typeof obj !== "object") return null;

  // gridRenderer.items
  if (obj.gridRenderer?.items) return obj.gridRenderer.items;

  // richGridRenderer.contents
  if (obj.richGridRenderer?.contents) return obj.richGridRenderer.contents;

  // 再帰的に探索
  for (const key in obj) {
    const found = findGridItems(obj[key]);
    if (found) return found;
  }

  return null;
}

const grid = findGridItems(data) || [];

// ★★★ videos はここで 1 回だけ生成する（これが正しい）★★★
const videos = grid
  .map(v => v.gridVideoRenderer || v.richItemRenderer?.content?.videoRenderer)
  .filter(v => v && v.videoId)
  .map(v => ({
    id: v.videoId,
    title:
      v.title?.simpleText ||
      v.title?.runs?.map(r => r.text).join("") ||
      "No Title",
    thumb: v.thumbnail?.thumbnails?.slice(-1)[0]?.url || ""
  }));

// 最大 60 件
const list60 = videos.slice(0, 60);

// チャンネル名
const title =
  data.metadata?.channelMetadataRenderer?.title ||
  "チャンネル名取得不可";

// HTML 出力
let list = `
  <html>
  <head>${CSS}</head>
  <body>

    ${SIDEBAR_HTML}

    <div id="main-content" class="main-content">
      <h2>${title} の動画一覧</h2>
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
// チャンネル検索（横幅広 UI）
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
          <form action="/channel-search/result" method="get">
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
app.get("/channel-search/result", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  const q = req.query.q;
  const region = req.query.region || "jp";

  // ★ 地域で URL 切替
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
// Invidious から動画情報・コメント取得（並走版）
// --------------------------------------
const RACE_COUNT = 5; // 同時に試すインスタンス数

async function tryInstance(instance, path, validate) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), INV_TIMEOUT);
  try {
    const res = await fetch(`${instance}${path}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error("not ok");
    const d = await res.json();
    if (!validate(d)) throw new Error("invalid");
    return d;
  } finally {
    clearTimeout(timer);
  }
}

async function raceInvidious(path, validate) {
  if (!invidiousApis) await loadInvidiousApis();
  if (!invidiousApis) throw new Error("APIリストなし");

  // シャッフルして先頭RACE_COUNT個を並走
  const shuffled = [...invidiousApis].sort(() => Math.random() - 0.5);
  const batch = shuffled.slice(0, RACE_COUNT);

  try {
    return await Promise.any(batch.map(inst => tryInstance(inst, path, validate)));
  } catch {
    // 残りも試す
    const rest = shuffled.slice(RACE_COUNT);
    for (const inst of rest) {
      try {
        return await tryInstance(inst, path, validate);
      } catch {}
    }
    throw new Error("全インスタンス失敗");
  }
}

async function getVideoInfo(videoId) {
  try {
    const d = await raceInvidious(`/api/v1/videos/${videoId}`, d => !!d.title);
    const streamUrl = [...(d.formatStreams || [])].reverse().map(s => s.url)[0] || null;
    const videoStreams = (d.adaptiveFormats || [])
      .filter(s => s.container === "webm" && s.resolution)
      .map(s => ({ url: s.url, resolution: s.resolution }));
    return {
      title: d.title || "タイトル不明",
      channelName: d.author || "",
      channelId: d.authorId || "",
      published: d.publishedText || "",
      viewCount: d.viewCountText || String(d.viewCount || ""),
      likeCount: d.likeCount || "",
      description: d.description || "",
      streamUrl,
      videoStreams
    };
  } catch (e) {
    console.error("getVideoInfo失敗:", e.message);
    return null;
  }
}

async function getComments(videoId) {
  try {
    const d = await raceInvidious(`/api/v1/comments/${videoId}?hl=ja`, d => Array.isArray(d.comments));
    return d.comments.slice(0, 20).map(c => ({
      author: c.author || "不明",
      text: c.content || "",
      likes: c.likeCount || 0,
      published: c.publishedText || ""
    }));
  } catch {
    return [];
  }
}

// 動画情報API（クライアントから非同期取得用）
app.get("/api/videoinfo/:id", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.status(401).json(null);
  const info = await getVideoInfo(req.params.id);
  res.json(info);
});

// コメントAPI
app.get("/api/comments/:id", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.status(401).json([]);
  const comments = await getComments(req.params.id);
  res.json(comments);
});

// --------------------------------------
// /watch（即時レスポンス + クライアント側非同期取得）
// --------------------------------------
app.post("/watch", async (req, res) => {
  const id = req.body.id;
  if (!id) return res.send("動画IDがありません");
  const user = req.cookies.user;

  // ページを即座に返す（情報はクライアント側で非同期取得）
  // 履歴はバックグラウンドで保存（awaitしない）
  getVideoInfo(id).then(info => {
    if (user && info) saveHistory(user, "watch", id, info.title).catch(() => {});
  });

  res.send(`
    <html>
    <head>
    ${CSS}
    <style>
      .watch-container { max-width: 900px; margin: 0 auto; padding: 0 16px 40px; }
      .video-wrap { position:relative; width:100%; aspect-ratio:16/9; background:#111; border-radius:10px; overflow:hidden; margin-bottom:14px; display:flex; align-items:center; justify-content:center; }
      .video-wrap iframe, .video-wrap video { position:absolute; top:0; left:0; width:100%; height:100%; border:none; }
      .video-wrap .loading-msg { color:#888; font-size:14px; }
      .meta-box { background:#fff; border-radius:10px; padding:16px; margin-bottom:14px; box-shadow:0 2px 8px rgba(0,0,0,0.08); }
      .video-title { font-size:18px; font-weight:bold; margin-bottom:10px; color:#1a1a1a; }
      .meta-row { display:flex; align-items:center; gap:12px; flex-wrap:wrap; color:#555; font-size:14px; margin-bottom:8px; }
      .channel-name { font-weight:bold; color:#2c3e50; font-size:15px; }
      .desc-box { font-size:13px; color:#555; white-space:pre-wrap; max-height:100px; overflow:hidden; transition:max-height 0.3s; }
      .desc-box.open { max-height:2000px; }
      .desc-toggle { background:none; border:none; color:#3498db; cursor:pointer; font-size:13px; padding:4px 0; width:auto; margin:0; }
      .quality-bar { margin-bottom:12px; font-size:13px; color:#555; }
      .q-btn { padding:4px 10px; margin:2px; border-radius:6px; border:1px solid #ccc; background:#fff; cursor:pointer; font-size:13px; width:auto; margin-bottom:0; }
      .q-btn.active { background:#3498db; color:#fff; border-color:#3498db; }
      .comments-box { background:#fff; border-radius:10px; padding:16px; box-shadow:0 2px 8px rgba(0,0,0,0.08); }
      .comment-item { border-bottom:1px solid #f0f0f0; padding:10px 0; }
      .comment-item:last-child { border-bottom:none; }
      .comment-author { font-weight:bold; font-size:13px; color:#2c3e50; }
      .comment-text { font-size:13px; color:#333; margin:4px 0; }
      .comment-meta { font-size:11px; color:#aaa; }
      .badge { display:inline-block; background:#e8f4ff; color:#3498db; border-radius:4px; padding:2px 8px; font-size:12px; }
      .skeleton { background:#eee; border-radius:4px; animation:pulse 1.2s infinite; }
      @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
    </style>
    </head>
    <body>
      ${SIDEBAR_HTML}
      <div id="main-content" class="main-content">
        <div class="watch-container">

          <!-- プレイヤー：即時iframe表示 -->
          <div class="video-wrap" id="player-wrap">
            <iframe id="yt-iframe"
              src="https://www.youtube.com/embed/${id}?autoplay=1&rel=0"
              allow="autoplay; fullscreen" allowfullscreen
              style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;">
            </iframe>
          </div>
          <div class="quality-bar" id="quality-bar" style="display:none;"></div>

          <div class="meta-box">
            <div class="video-title" id="v-title">
              <span class="skeleton" style="display:inline-block;width:70%;height:20px;"></span>
            </div>
            <div class="meta-row" id="v-meta">
              <span class="skeleton" style="width:120px;height:14px;"></span>
              <span class="skeleton" style="width:80px;height:14px;"></span>
            </div>
            <div id="v-desc-wrap" style="display:none;">
              <div class="desc-box" id="v-desc"></div>
              <button class="desc-toggle" onclick="toggleDesc()">▼ 続きを読む</button>
            </div>
          </div>

          <div class="comments-box">
            <h3 style="margin:0 0 12px;font-size:16px;">💬 コメント</h3>
            <div id="comments-list">
              <p style="color:#aaa;font-size:13px;">読み込み中...</p>
            </div>
          </div>

        </div>
      </div>
      ${SIDEBAR_JS}
      <script>
      const videoId = "${id}";

      function postWatch(id) {
        const form = document.createElement("form");
        form.method = "POST"; form.action = "/watch";
        const inp = document.createElement("input");
        inp.type = "hidden"; inp.name = "id"; inp.value = id;
        form.appendChild(inp); document.body.appendChild(form); form.submit();
      }

      function toggleDesc() {
        const d = document.getElementById("v-desc");
        const btn = d.nextElementSibling;
        d.classList.toggle("open");
        btn.textContent = d.classList.contains("open") ? "▲ 閉じる" : "▼ 続きを読む";
      }

      function changeQ(url, btn) {
        const p = document.getElementById("stream-player");
        if (!p) return;
        const t = p.currentTime;
        p.src = url; p.currentTime = t; p.play();
        document.querySelectorAll(".q-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      }

      function showStreamPlayer(streamUrl, videoStreams) {
        const wrap = document.getElementById("player-wrap");
        wrap.innerHTML = '<video id="stream-player" controls autoplay style="position:absolute;top:0;left:0;width:100%;height:100%;">'
          + '<source src="' + streamUrl + '" type="video/mp4">'
          + '</video>';
        if (videoStreams && videoStreams.length) {
          const bar = document.getElementById("quality-bar");
          bar.style.display = "block";
          bar.innerHTML = "画質：" + videoStreams.map(s =>
            '<button class="q-btn" onclick="changeQ(\'' + s.url + '\',this)">' + s.resolution + '</button>'
          ).join("");
        }
      }

      // iframeのエラー検知（制限動画はYouTubeがエラー画面を表示する）
      // postMessageでYouTube Player APIのエラーを受信
      let streamFetched = false;
      window.addEventListener("message", function(e) {
        if (!e.origin.includes("youtube.com")) return;
        try {
          const data = JSON.parse(e.data);
          if (data.event === "infoDelivery" && data.info && data.info.playerState === 5) return;
          // エラーコード 100,101,150 = 制限・非公開
          if (data.event === "onError" || (data.info && [100,101,150].includes(data.info))) {
            loadStream();
          }
        } catch {}
      });

      // iframeロード後にJS APIを有効化して監視
      document.getElementById("yt-iframe").src =
        "https://www.youtube.com/embed/${id}?autoplay=1&rel=0&enablejsapi=1";

      let streamLoading = false;
      async function loadStream() {
        if (streamLoading) return;
        streamLoading = true;
        try {
          const r = await fetch("/api/videoinfo/" + videoId);
          const info = await r.json();
          if (info && info.streamUrl) showStreamPlayer(info.streamUrl, info.videoStreams);
        } catch {}
      }

      // メタ情報・コメントは完全に非同期（再生に影響しない）
      fetch("/api/videoinfo/" + videoId)
        .then(r => r.json())
        .then(info => {
          if (!info) return;
          document.getElementById("v-title").textContent = info.title;
          document.title = info.title;
          let metaHTML = "";
          if (info.channelName) metaHTML += '<span class="channel-name">📺 ' + info.channelName + '</span>';
          if (info.published)   metaHTML += '<span>📅 ' + info.published + '</span>';
          if (info.viewCount)   metaHTML += '<span>👁 ' + info.viewCount + '</span>';
          if (info.likeCount)   metaHTML += '<span>👍 ' + Number(info.likeCount).toLocaleString() + '</span>';
          document.getElementById("v-meta").innerHTML = metaHTML;
          if (info.description) {
            document.getElementById("v-desc").innerHTML = info.description.replace(/</g,"&lt;").replace(/\n/g,"<br>");
            document.getElementById("v-desc-wrap").style.display = "block";
          }
        }).catch(() => {});

      fetch("/api/comments/" + videoId)
        .then(r => r.json())
        .then(comments => {
          const box = document.getElementById("comments-list");
          if (!comments.length) { box.innerHTML = '<p style="color:#aaa;font-size:13px;">コメントを取得できませんでした</p>'; return; }
          box.innerHTML = comments.map(c =>
            '<div class="comment-item">' +
            '<div class="comment-author">' + c.author.replace(/</g,"&lt;") + '</div>' +
            '<div class="comment-text">' + c.text.replace(/</g,"&lt;").replace(/\n/g,"<br>") + '</div>' +
            '<div class="comment-meta">👍 ' + c.likes + '  ・  ' + c.published + '</div>' +
            '</div>'
          ).join("");
        }).catch(() => {
          document.getElementById("comments-list").innerHTML =
            '<p style="color:#aaa;font-size:13px;">コメントを取得できませんでした</p>';
        });

      // コメントを非同期取得
      fetch("/api/comments/" + videoId)
        .then(r => r.json())
        .then(comments => {
          const box = document.getElementById("comments-list");
          if (!comments.length) {
            box.innerHTML = '<p style="color:#aaa;font-size:13px;">コメントを取得できませんでした</p>';
            return;
          }
          box.innerHTML = comments.map(c =>
            '<div class="comment-item">' +
            '<div class="comment-author">' + c.author.replace(/</g,"&lt;") + '</div>' +
            '<div class="comment-text">' + c.text.replace(/</g,"&lt;").replace(/\\n/g,"<br>") + '</div>' +
            '<div class="comment-meta">👍 ' + c.likes + '  ・  ' + c.published + '</div>' +
            '</div>'
          ).join("");
        })
        .catch(() => {
          document.getElementById("comments-list").innerHTML =
            '<p style="color:#aaa;font-size:13px;">コメントを取得できませんでした</p>';
        });
      </script>
    </body>
    </html>
  `);
});

// --------------------------------------
// 履歴ページ（ユーザー用） PostgreSQL 版
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
        <h2>${user} さんの検索履歴</h2>

        <form action="/history/delete" method="POST">
          <button class="danger" style="width:200px;">履歴をすべて削除</button>
        </form>
        <br>
  `;

  html += data.map((item, index) => `
    <div class="history-card">
      ${formatDateJP(item.created_at)}<br>
      <strong>${item.query}</strong><br>

      <a href="#" onclick="postWatch('${item.video_id}')">
        ${item.title}
      </a>

      <br><br>
      <a href="/history/delete-one?index=${index}" style="color:red;">この履歴を削除</a>
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
  `;   // ← ← ← ★★★ ここでテンプレート文字列が正しく閉じる ★★★

  res.send(html);
});
// --------------------------------------
// 履歴削除（ユーザー用・全削除）
// --------------------------------------
app.post("/history/delete", (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  const file = `history_user_${user}.json`;

  if (fs.existsSync(file)) fs.unlinkSync(file);

  res.redirect("/history");
});

// --------------------------------------
// 履歴削除（ユーザー用・1件削除）
// --------------------------------------
app.get("/history/delete-one", (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  const index = parseInt(req.query.index);
  const file = `history_user_${user}.json`;

  let data = [];
  if (fs.existsSync(file)) {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  }

  if (!isNaN(index) && data[index]) {
    data.splice(index, 1);
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  }

  res.redirect("/history");
});
// --------------------------------------
// 管理者ページ（本物の履歴）
// --------------------------------------
const ADMIN_PASSWORD = "jagdyufr5t62";

// --------------------------------------
// GET /admin（ログイン画面 or パスワード確認）
// --------------------------------------
app.get("/admin", (req, res) => {
  const user = req.cookies.user;
  const pass = req.query.pass;

  // ① ログインしていない
  if (!user) return res.redirect("/login");

  // ② ユーザー名が hinata 以外
  if (user !== "hinata") {
    return res.send("あなたには管理者ページへのアクセス権がありません");
  }

  // ③ パスワードが違う → ログイン画面を表示
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

  // ④ パスワードが正しい → POST /admin に飛ばすフォームを自動送信
  res.send(`
    <form id="f" method="POST" action="/admin">
      <input type="hidden" name="pass" value="${ADMIN_PASSWORD}">
    </form>
    <script>document.getElementById("f").submit();</script>
  `);
});


// --------------------------------------
// POST /admin（本物の履歴表示）
// --------------------------------------
app.post("/admin", async (req, res) => {
  const pass = req.body.pass;
  if (pass !== ADMIN_PASSWORD) {
    return res.send("パスワードが違います");
  }

  // ★★★ PostgreSQL から履歴を取得 ★★★
  const result = await pool.query(`
    SELECT user_id, query, video_id, title, created_at
    FROM history
    ORDER BY created_at DESC
  `);

  // ユーザーごとにグループ化
  const historyByUser = {};
  for (const row of result.rows) {
    if (!historyByUser[row.user_id]) {
      historyByUser[row.user_id] = [];
    }
    historyByUser[row.user_id].push(row);
  }

  let allHistoryHTML = "";
  let deleteButtonsHTML = "";

  // ★★★ ユーザーごとに HTML を生成 ★★★
  for (const userName in historyByUser) {
    const data = historyByUser[userName];

    allHistoryHTML += `<h3>${userName}</h3>`;
    allHistoryHTML += data.map(item => `
      <div class="history-card">
        ${formatDateJP(item.created_at)}<br>
        <strong>${item.query}</strong><br>

        <a href="#" onclick="postWatch('${item.video_id}')">
          ${item.title}
        </a>
      </div>
    `).join("");

    // ★★★ 削除ボタンは for の中に置く ★★★
    deleteButtonsHTML += `
      <form method="POST" action="/admin/delete-user">
        <input type="hidden" name="user" value="${userName}">
        <input type="hidden" name="pass" value="${ADMIN_PASSWORD}">
        <button class="danger" style="width:200px;">${userName} の履歴を削除</button>
      </form>
      <br>
    `;
  }

  // ★★★ 管理者ページ HTML ★★★
  res.send(`
    <html>
    <head>${CSS}</head>
    <body>

      ${SIDEBAR_HTML}

      <div id="main-content" class="main-content">
        <h2>管理者ページ</h2>

        <div class="tabs">
          <div class="tab active" id="tab-all" onclick="openTab('all')">全履歴</div>
          <div class="tab" id="tab-delete" onclick="openTab('delete')">ユーザー削除</div>
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
// POST /admin/delete-user（特定ユーザーの履歴削除）
// --------------------------------------
app.post("/admin/delete-user", async (req, res) => {
  const pass = req.body.pass;
  const user = req.body.user;

  // パスワードチェック
  if (pass !== ADMIN_PASSWORD) {
    return res.send("パスワードが違います");
  }

  // 履歴削除
  await pool.query(
    `DELETE FROM history WHERE user_id = $1`,
    [user]
  );

  // 管理者ページに戻る
  res.redirect(`/admin?pass=${ADMIN_PASSWORD}`);
});

// --------------------------------------
// Shorts API（動画IDリスト返却）
// --------------------------------------
// --------------------------------------
// Shorts取得（Invidious trending API + キャッシュ）
// --------------------------------------
let shortsCache = null;
let shortsCacheTime = 0;
const SHORTS_CACHE_TTL = 10 * 60 * 1000; // 10分

async function fetchShorts(limit = 20) {
  // キャッシュが有効なら即返す
  if (shortsCache && Date.now() - shortsCacheTime < SHORTS_CACHE_TTL) {
    return shortsCache.slice(0, limit);
  }

  if (!invidiousApis) await loadInvidiousApis();
  if (!invidiousApis) throw new Error("APIリストを取得できません");

  for (const instance of invidiousApis) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), INV_TIMEOUT);
      const res = await fetch(
        `${instance}/api/v1/trending?type=shorts&region=JP&hl=ja`,
        { signal: controller.signal }
      );
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) continue;

      const shorts = data
        .filter(v => v.videoId && v.lengthSeconds <= 60)
        .slice(0, 40)
        .map(v => ({ id: v.videoId, title: v.title || v.videoId }));

      if (!shorts.length) continue;

      // キャッシュ更新
      shortsCache = shorts;
      shortsCacheTime = Date.now();
      return shorts.slice(0, limit);
    } catch (e) {
      console.error(`Shorts取得失敗 ${instance}:`, e.message);
    }
  }
  throw new Error("Shortsを取得できませんでした");
}

app.get("/shorts/api", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.status(401).json([]);
  const limit = Math.min(parseInt(req.query.limit) || 20, 40);
  try {
    const shorts = await fetchShorts(limit);
    res.json(shorts);
  } catch (e) {
    console.error("Shorts取得エラー:", e.message);
    res.json([]);
  }
});

// --------------------------------------
// Shorts ページ（TikTok風縦スクロール）
// --------------------------------------
app.get("/shorts", (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  res.send(`
    <html>
    <head>
      ${CSS}
      <style>
        body { overflow: hidden; background: #000; }

        .shorts-container {
          position: fixed;
          top: 0; left: 50px; right: 0; bottom: 0;
          overflow-y: scroll;
          scroll-snap-type: y mandatory;
          -webkit-overflow-scrolling: touch;
        }

        .short-item {
          height: 100dvh;
          scroll-snap-align: start;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          background: #000;
        }

        .short-item video {
          height: 100%;
          max-height: 100dvh;
          max-width: 100%;
          aspect-ratio: 9/16;
          object-fit: contain;
          display: block;
        }

        .short-item iframe {
          height: 100%;
          max-height: 100dvh;
          aspect-ratio: 9/16;
          border: none;
        }

        .short-info {
          position: absolute;
          bottom: 30px;
          left: 16px;
          right: 60px;
          color: #fff;
          text-shadow: 0 1px 4px rgba(0,0,0,0.8);
          pointer-events: none;
        }

        .short-info .title {
          font-size: 15px;
          font-weight: bold;
          margin-bottom: 6px;
        }

        .short-actions {
          position: absolute;
          right: 10px;
          bottom: 80px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 18px;
        }

        .short-btn {
          background: rgba(255,255,255,0.15);
          border: none;
          border-radius: 50%;
          width: 44px; height: 44px;
          font-size: 20px;
          cursor: pointer;
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(4px);
        }
        .short-btn:hover { background: rgba(255,255,255,0.3); }

        .nav-bar {
          position: fixed;
          top: 0; left: 50px; right: 0;
          height: 48px;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          padding: 0 16px;
          z-index: 100;
          gap: 12px;
          color: #fff;
          font-size: 16px;
          font-weight: bold;
        }

        .nav-bar a { color: #aaa; text-decoration: none; font-size: 14px; }
        .nav-bar a:hover { color: #fff; }

        .loading-card {
          height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 18px;
          scroll-snap-align: start;
        }

        /* サイドバーは上書き */
        .sidebar { background: rgba(20,20,20,0.95) !important; border-right: 1px solid #333 !important; }
        .sidebar a { color: #ccc !important; }
        .sidebar a:hover { background: #222 !important; }
      </style>
    </head>
    <body>
      ${SIDEBAR_HTML}

      <div class="nav-bar">
        <span>📱 Shorts</span>
        <a href="/">← ホーム</a>
      </div>

      <div class="shorts-container" id="shortsContainer">
        <div class="loading-card">読み込み中...</div>
      </div>

      ${SIDEBAR_JS}

      <script>
      const container = document.getElementById("shortsContainer");
      let shorts = [];
      let currentIndex = 0;
      let rendered = 0;

      async function loadShorts() {
        const res = await fetch("/shorts/api?limit=30");
        shorts = await res.json();
        container.innerHTML = "";
        if (!shorts.length) {
          container.innerHTML = '<div class="loading-card">Shortsを取得できませんでした</div>';
          return;
        }
        // 最初の3件をレンダリング
        for (let i = 0; i < Math.min(3, shorts.length); i++) renderShort(i);
        // 最初の動画を自動再生
        activateShort(0);
      }

      function renderShort(i) {
        if (i >= shorts.length || rendered > i) return;
        rendered = i + 1;
        const s = shorts[i];
        const item = document.createElement("div");
        item.className = "short-item";
        item.dataset.index = i;
        item.dataset.id = s.id;

        item.innerHTML =
          '<iframe id="iframe-' + i + '"' +
          ' src=""' +
          ' data-src="https://www.youtube.com/embed/' + s.id + '?autoplay=1&mute=1&loop=1&playlist=' + s.id + '&rel=0&modestbranding=1&playsinline=1"' +
          ' allow="autoplay; fullscreen" allowfullscreen></iframe>' +
          '<div class="short-info">' +
          '<div class="title">' + s.title + '</div>' +
          '</div>' +
          '<div class="short-actions">' +
          '<button class="short-btn" title="YouTubeで開く" onclick="openYT(\'' + s.id + '\')">▶</button>' +
          '<button class="short-btn" title="動画を見る" onclick="postWatch(\'' + s.id + '\')">🎬</button>' +
          '</div>';

        container.appendChild(item);
      }

      // スクロール監視: 次の動画を先読みレンダリング＆自動再生切替
      function activateShort(idx) {
        // 全iframeを停止（srcを空に）
        document.querySelectorAll(".short-item iframe").forEach(f => {
          if (f.src !== "") f.src = "";
        });
        // 対象のiframeを再生開始
        const target = document.getElementById("iframe-" + idx);
        if (target && target.dataset.src) {
          target.src = target.dataset.src;
        }
      }

      container.addEventListener("scroll", () => {
        const h = window.innerHeight;
        const idx = Math.round(container.scrollTop / h);
        if (idx !== currentIndex) {
          currentIndex = idx;
          renderShort(idx + 1);
          renderShort(idx + 2);
          activateShort(idx);
        }
      }, { passive: true });

      function openYT(id) {
        window.open("https://www.youtube.com/shorts/" + id, "_blank");
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

      loadShorts();
      </script>
    </body>
    </html>
  `);
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

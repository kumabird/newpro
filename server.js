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
// ユーティリティ関数
// --------------------------------------

// HTMLエスケープ（XSS対策）
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

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
// 改善版CSS（スマホ対応 + UI向上）
// --------------------------------------
const CSS = `
<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    color: #333;
  }

  h2 {
    margin-bottom: 20px;
    color: #2c3e50;
    text-align: center;
    font-size: 28px;
    font-weight: 600;
  }

  /* ハンバーガーメニューボタン（モバイル用） */
  .menu-toggle {
    display: none;
    position: fixed;
    top: 15px;
    left: 15px;
    z-index: 2000;
    background: white;
    border: none;
    border-radius: 8px;
    width: 45px;
    height: 45px;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    font-size: 24px;
  }

  /* サイドバー */
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    width: 70px;
    height: 100%;
    background: white;
    border-right: 1px solid #e0e0e0;
    padding-top: 20px;
    transition: width 0.3s ease, transform 0.3s ease;
    overflow: hidden;
    z-index: 1000;
    box-shadow: 2px 0 10px rgba(0,0,0,0.05);
  }

  .sidebar.open {
    width: 240px;
  }

  .sidebar a {
    display: flex;
    align-items: center;
    gap: 15px;
    padding: 16px 20px;
    font-size: 16px;
    color: #555;
    text-decoration: none;
    white-space: nowrap;
    transition: background 0.2s ease, color 0.2s ease;
    border-left: 3px solid transparent;
  }

  .sidebar a:hover {
    background: linear-gradient(90deg, #f0f4ff 0%, #ffffff 100%);
    color: #667eea;
    border-left-color: #667eea;
  }

  .sidebar-icon {
    font-size: 22px;
    min-width: 30px;
    text-align: center;
  }

  /* メインコンテンツ */
  .main-content {
    margin-left: 90px;
    padding: 30px 20px;
    transition: margin-left 0.3s ease;
    min-height: 100vh;
  }

  .main-content.shift {
    margin-left: 260px;
  }

  /* カードコンテナ */
  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  /* カードグリッド */
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 24px;
    padding: 20px 0;
  }

  .card {
    background: white;
    padding: 0;
    border-radius: 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    overflow: hidden;
    cursor: pointer;
  }

  .card:hover {
    transform: translateY(-8px);
    box-shadow: 0 12px 24px rgba(0,0,0,0.15);
  }

  .card img.thumb {
    width: 100%;
    height: 180px;
    object-fit: cover;
    display: block;
  }

  .card-content {
    padding: 15px;
  }

  .card-title {
    font-weight: 600;
    font-size: 15px;
    line-height: 1.4;
    color: #333;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* 中央ボックス（ログインなど） */
  .center-box {
    max-width: 420px;
    margin: 80px auto;
    background: white;
    padding: 40px;
    border-radius: 20px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
  }

  .center-box h2 {
    margin-bottom: 30px;
    color: #667eea;
  }

  /* 検索ボックス */
  .search-box {
    max-width: 800px;
    margin: 0 auto 40px;
    background: white;
    padding: 30px;
    border-radius: 16px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  }

  /* フォーム要素 */
  input[type="text"],
  input[type="password"],
  select,
  .region-select {
    width: 100%;
    padding: 14px 16px;
    font-size: 16px;
    border-radius: 10px;
    border: 2px solid #e0e0e0;
    margin-bottom: 16px;
    background: white;
    transition: border-color 0.3s ease, box-shadow 0.3s ease;
    font-family: inherit;
  }

  input:focus,
  select:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
  }

  button {
    width: 100%;
    padding: 14px 16px;
    font-size: 16px;
    font-weight: 600;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    font-family: inherit;
  }

  button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
  }

  button:active {
    transform: translateY(0);
  }

  button.danger {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  }

  /* 履歴カード */
  .history-card {
    background: white;
    padding: 20px;
    margin-bottom: 15px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    border-left: 4px solid #667eea;
  }

  .history-card strong {
    color: #667eea;
    font-size: 16px;
  }

  .history-card a {
    color: #555;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .history-card a:hover {
    color: #667eea;
    text-decoration: underline;
  }

  /* エラーページ */
  .error-container {
    max-width: 600px;
    margin: 100px auto;
    text-align: center;
    background: white;
    padding: 50px;
    border-radius: 20px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.15);
  }

  .error-icon {
    font-size: 80px;
    margin-bottom: 20px;
  }

  .error-title {
    font-size: 32px;
    color: #f5576c;
    margin-bottom: 15px;
  }

  .error-message {
    font-size: 18px;
    color: #666;
    margin-bottom: 30px;
    line-height: 1.6;
  }

  .error-link {
    display: inline-block;
    padding: 12px 30px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    text-decoration: none;
    border-radius: 10px;
    font-weight: 600;
    transition: transform 0.2s ease;
  }

  .error-link:hover {
    transform: translateY(-2px);
  }

  /* ローディング */
  .loading {
    text-align: center;
    padding: 40px;
    font-size: 18px;
    color: #667eea;
  }

  .spinner {
    border: 4px solid #f3f3f3;
    border-top: 4px solid #667eea;
    border-radius: 50%;
    width: 50px;
    height: 50px;
    animation: spin 1s linear infinite;
    margin: 20px auto;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* タブ（管理者ページ用） */
  .tabs {
    display: flex;
    gap: 10px;
    margin-bottom: 30px;
    border-bottom: 2px solid #e0e0e0;
  }

  .tab {
    padding: 12px 24px;
    cursor: pointer;
    border-bottom: 3px solid transparent;
    transition: all 0.3s ease;
    font-weight: 600;
    color: #666;
  }

  .tab:hover {
    color: #667eea;
  }

  .tab.active {
    color: #667eea;
    border-bottom-color: #667eea;
  }

  .tab-content {
    display: none;
  }

  .tab-content.active {
    display: block;
  }

  /* レスポンシブデザイン */
  @media (max-width: 768px) {
    .menu-toggle {
      display: block;
    }

    .sidebar {
      width: 0;
      transform: translateX(-100%);
      padding-top: 70px;
    }

    .sidebar.open {
      width: 280px;
      transform: translateX(0);
    }

    .main-content {
      margin-left: 0;
      padding: 80px 15px 30px;
    }

    .main-content.shift {
      margin-left: 0;
    }

    .card-grid {
      grid-template-columns: 1fr;
      gap: 16px;
    }

    .center-box {
      margin: 40px 15px;
      padding: 30px 20px;
    }

    .search-box {
      padding: 20px;
      margin-bottom: 30px;
    }

    h2 {
      font-size: 24px;
    }

    .error-container {
      margin: 50px 15px;
      padding: 30px 20px;
    }

    .error-icon {
      font-size: 60px;
    }

    .error-title {
      font-size: 24px;
    }
  }

  @media (min-width: 769px) and (max-width: 1024px) {
    .card-grid {
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    }
  }

  /* ダークモード対応 */
  @media (prefers-color-scheme: dark) {
    body {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    }

    .sidebar {
      background: #2a2a3e;
      border-right-color: #3a3a4e;
    }

    .sidebar a {
      color: #b0b0c0;
    }

    .sidebar a:hover {
      background: linear-gradient(90deg, #3a3a4e 0%, #2a2a3e 100%);
      color: #667eea;
    }

    .card,
    .center-box,
    .search-box,
    .history-card,
    .error-container {
      background: #2a2a3e;
      color: #e0e0e0;
    }

    .card-title,
    h2 {
      color: #e0e0e0;
    }

    input,
    select {
      background: #3a3a4e;
      border-color: #4a4a5e;
      color: #e0e0e0;
    }

    .menu-toggle {
      background: #2a2a3e;
      color: #e0e0e0;
    }
  }
</style>
`;

// --------------------------------------
// サイドバー HTML
// --------------------------------------
const SIDEBAR_HTML = `
<button class="menu-toggle" onclick="toggleSidebar()" aria-label="メニュー">☰</button>
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

// デスクトップ: ホバーで開閉
if (window.innerWidth > 768) {
  sidebar.addEventListener("mouseenter", () => {
    sidebar.classList.add("open");
    main.classList.add("shift");
  });

  sidebar.addEventListener("mouseleave", () => {
    sidebar.classList.remove("open");
    main.classList.remove("shift");
  });
}

// モバイル: ボタンでトグル
function toggleSidebar() {
  sidebar.classList.toggle("open");
}

// サイドバー外クリックで閉じる（モバイル）
document.addEventListener("click", (e) => {
  if (window.innerWidth <= 768) {
    const menuToggle = document.querySelector(".menu-toggle");
    if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
      sidebar.classList.remove("open");
    }
  }
});
</script>
`;

// --------------------------------------
// エラーページ生成関数
// --------------------------------------
function renderError(title, message, backLink = "/") {
  return `
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(title)}</title>
      ${CSS}
    </head>
    <body>
      <div class="error-container">
        <div class="error-icon">⚠️</div>
        <h1 class="error-title">${escapeHtml(title)}</h1>
        <p class="error-message">${escapeHtml(message)}</p>
        <a href="${backLink}" class="error-link">ホームに戻る</a>
      </div>
    </body>
    </html>
  `;
}

// --------------------------------------
// ログイン画面
// --------------------------------------
app.get("/login", (req, res) => {
  res.send(`
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ログイン</title>
      ${CSS}
    </head>
    <body>
      <div class="center-box">
        <h2>ログイン</h2>
        <form method="POST" action="/login">
          <input name="user" placeholder="ユーザー名" required autocomplete="username">
          <input name="pass" type="password" placeholder="パスワード" required autocomplete="current-password">
          <button type="submit">ログイン</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

app.post("/login", (req, res) => {
  try {
    const { user, pass } = req.body;
    const users = loadUsers();

    const found = users.find(u => u.user === user && u.pass === pass);
    if (!found) {
      return res.send(renderError("ログイン失敗", "ユーザー名またはパスワードが間違っています", "/login"));
    }

    res.cookie("user", user, { 
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24時間
    });
    res.redirect("/");
  } catch (error) {
    console.error("Login error:", error);
    res.send(renderError("エラー", "ログイン処理中にエラーが発生しました", "/login"));
  }
});

// --------------------------------------
// ホーム（ルート重複を削除し、1つに統合）
// --------------------------------------
app.get("/", (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  res.send(`
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ホーム</title>
      ${CSS}
    </head>
    <body>
      ${SIDEBAR_HTML}

      <div id="main-content" class="main-content">
        <div class="container">
          <div class="search-box">
            <h2>動画検索</h2>
            <form action="/search" method="post">
              <input type="text" name="q" placeholder="検索ワードを入力" required>
              <select name="region" class="region-select">
                <option value="jp">日本のみ</option>
                <option value="global">全世界</option>
              </select>
              <button type="submit">🔍 動画を検索</button>
            </form>
          </div>
        </div>
      </div>

      ${SIDEBAR_JS}
    </body>
    </html>
  `);
});

// --------------------------------------
// 動画検索（エラーハンドリング追加）
// --------------------------------------
app.post("/search", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  try {
    const q = req.body.q;
    const region = req.body.region || "jp";

    if (!q) {
      return res.send(renderError("入力エラー", "検索ワードを入力してください"));
    }

    // URL構築
    let url;
    if (region === "global") {
      url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    } else {
      url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&gl=JP&hl=ja`;
    }

    // YouTube取得
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`YouTube API returned ${response.status}`);
    }

    const html = await response.text();

    // 動画パース
    const videoMatches = [...html.matchAll(/"videoId":"(.*?)".*?"title":\{"runs":\[\{"text":"(.*?)"\}\]/gs)];

    if (videoMatches.length === 0) {
      return res.send(renderError("検索結果なし", "検索結果が見つかりませんでした。別のキーワードをお試しください。"));
    }

    const videos = videoMatches.slice(0, 60).map(m => ({
      id: m[1],
      title: m[2]
    }));

    // HTML出力
    let list = `
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>検索結果: ${escapeHtml(q)}</title>
        ${CSS}
      </head>
      <body>
        ${SIDEBAR_HTML}  

        <div id="main-content" class="main-content">
          <div class="container">
            <h2>🔍 検索結果: ${escapeHtml(q)} <small style="font-size:18px;color:#888;">(${region === "jp" ? "日本" : "全世界"})</small></h2>
            <div class="card-grid">
    `;

    list += videos.map(v => `
      <form action="/watch" method="post" style="margin:0;">
        <input type="hidden" name="id" value="${escapeHtml(v.id)}">
        <button type="submit" style="all:unset;display:block;width:100%;">
          <div class="card">
            <img class="thumb" src="https://i.ytimg.com/vi/${escapeHtml(v.id)}/hqdefault.jpg" alt="${escapeHtml(v.title)}">
            <div class="card-content">
              <div class="card-title">${escapeHtml(v.title)}</div>
            </div>
          </div>
        </button>
      </form>
    `).join("");

    list += `
            </div>
          </div>
        </div>

        ${SIDEBAR_JS}
      </body>
      </html>
    `;

    res.send(list);

  } catch (error) {
    console.error("Search error:", error);
    res.send(renderError("検索エラー", "検索中にエラーが発生しました。しばらくしてからもう一度お試しください。"));
  }
});

// --------------------------------------
// チャンネル動画一覧（エラーハンドリング追加）
// --------------------------------------
app.get("/channel-videos", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  try {
    const id = req.query.id;
    if (!id) {
      return res.send(renderError("入力エラー", "チャンネルIDが指定されていません", "/channel-search"));
    }

    const url = `https://www.youtube.com/channel/${id}/videos?hl=ja&gl=JP`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`YouTube returned ${response.status}`);
    }

    const html = await response.text();

    // ytInitialData を抽出
    let jsonText =
      html.match(/ytInitialData"\]\s*=\s*(\{.*?\});/) ||
      html.match(/var ytInitialData = (\{.*?\});/) ||
      html.match(/window\["ytInitialData"\]\s*=\s*(\{.*?\});/);

    if (!jsonText) {
      return res.send(renderError("データ取得エラー", "チャンネルデータを取得できませんでした", "/channel-search"));
    }

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
          "No Title",
        thumb: v.thumbnail?.thumbnails?.slice(-1)[0]?.url || ""
      }));

    const list60 = videos.slice(0, 60);

    const channelTitle =
      data.metadata?.channelMetadataRenderer?.title ||
      "チャンネル名取得不可";

    let list = `
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(channelTitle)}</title>
        ${CSS}
      </head>
      <body>
        ${SIDEBAR_HTML}

        <div id="main-content" class="main-content">
          <div class="container">
            <h2>📺 ${escapeHtml(channelTitle)}</h2>
            <div class="card-grid">
    `;

    list += list60.map(v => `
      <form action="/watch" method="post" style="margin:0;">
        <input type="hidden" name="id" value="${escapeHtml(v.id)}">
        <button type="submit" style="all:unset;display:block;width:100%;">
          <div class="card">
            <img class="thumb" src="https://i.ytimg.com/vi/${escapeHtml(v.id)}/hqdefault.jpg" alt="${escapeHtml(v.title)}">
            <div class="card-content">
              <div class="card-title">${escapeHtml(v.title)}</div>
            </div>
          </div>
        </button>
      </form>
    `).join("");

    list += `
            </div>
          </div>
        </div>

        ${SIDEBAR_JS}
      </body>
      </html>
    `;

    res.send(list);

  } catch (error) {
    console.error("Channel videos error:", error);
    res.send(renderError("エラー", "チャンネル動画の取得中にエラーが発生しました", "/channel-search"));
  }
});

// --------------------------------------
// チャンネル検索
// --------------------------------------
app.get("/channel-search", (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  res.send(`
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>チャンネル検索</title>
      ${CSS}
    </head>
    <body>
      ${SIDEBAR_HTML}

      <div id="main-content" class="main-content">
        <div class="container">
          <div class="search-box">
            <h2>チャンネル検索</h2>
            <form action="/channel-search/result" method="get">
              <input type="text" name="q" placeholder="チャンネル名を入力" required>
              <select name="region" class="region-select">
                <option value="jp">日本のみ</option>
                <option value="global">全世界</option>
              </select>
              <button type="submit">📺 検索</button>
            </form>
          </div>
        </div>
      </div>

      ${SIDEBAR_JS}
    </body>
    </html>
  `);
});

// --------------------------------------
// チャンネル検索結果（エラーハンドリング追加）
// --------------------------------------
app.get("/channel-search/result", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  try {
    const q = req.query.q;
    const region = req.query.region || "jp";

    if (!q) {
      return res.send(renderError("入力エラー", "チャンネル名を入力してください", "/channel-search"));
    }

    let url;
    if (region === "global") {
      url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAg%253D%253D`;
    } else {
      url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAg%253D%253D&hl=ja&gl=JP`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`YouTube returned ${response.status}`);
    }

    const html = await response.text();

    const jsonText = html.match(/var ytInitialData = (.*?);<\/script>/s);
    if (!jsonText) {
      return res.send(renderError("データ取得エラー", "チャンネルデータを取得できませんでした", "/channel-search"));
    }

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

    if (channels.length === 0) {
      return res.send(renderError("検索結果なし", "チャンネルが見つかりませんでした。別のキーワードをお試しください。", "/channel-search"));
    }

    const list60 = channels.slice(0, 60);

    res.send(`
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>チャンネル検索結果: ${escapeHtml(q)}</title>
        ${CSS}
      </head>
      <body>
        ${SIDEBAR_HTML}

        <div id="main-content" class="main-content">
          <div class="container">
            <h2>📺 チャンネル検索結果: ${escapeHtml(q)} <small style="font-size:18px;color:#888;">(${region === "jp" ? "日本" : "全世界"})</small></h2>
            <div class="card-grid">
              ${list60.map(c => `
                <div class="card" onclick="location.href='/channel-videos?id=${escapeHtml(c.id)}'" style="cursor:pointer;">
                  <img class="thumb" src="${escapeHtml(c.icon)}" alt="${escapeHtml(c.title)}">
                  <div class="card-content">
                    <div class="card-title">${escapeHtml(c.title)}</div>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        </div>

        ${SIDEBAR_JS}
      </body>
      </html>
    `);

  } catch (error) {
    console.error("Channel search error:", error);
    res.send(renderError("検索エラー", "チャンネル検索中にエラーが発生しました", "/channel-search"));
  }
});

// --------------------------------------
// 動画視聴（エラーハンドリング追加）
// --------------------------------------
app.post("/watch", async (req, res) => {
  try {
    const id = req.body.id;
    if (!id) {
      return res.send(renderError("エラー", "動画IDが指定されていません"));
    }

    const user = req.cookies.user;
    const embedUrl = `https://www.youtube.com/embed/${id}`;
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`;

    let embeddable = true;
    let title = "動画タイトル不明";

    try {
      const check = await fetch(oembedUrl);
      if (!check.ok) {
        embeddable = false;
      } else {
        const data = await check.json();
        title = data.title || title;
      }
    } catch {
      embeddable = false;
    }

    if (!embeddable) {
      return res.redirect(`https://www.youtube.com/watch?v=${id}`);
    }

    // 履歴保存
    if (user) {
      await saveHistory(user, "watch", id, title);
    }

    res.send(`
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(title)}</title>
        ${CSS}
        <style>
          .video-container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          }
          .video-wrapper {
            position: relative;
            padding-bottom: 56.25%;
            height: 0;
            overflow: hidden;
            border-radius: 12px;
          }
          .video-wrapper iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
          }
          .video-title {
            margin-top: 20px;
            font-size: 24px;
            font-weight: 600;
            color: #333;
          }
          @media (max-width: 768px) {
            .video-container {
              padding: 20px 15px;
            }
            .video-title {
              font-size: 20px;
            }
          }
        </style>
      </head>
      <body>
        ${SIDEBAR_HTML}
        <div id="main-content" class="main-content">
          <div class="container">
            <div class="video-container">
              <div class="video-wrapper">
                <iframe
                  src="${embedUrl}"
                  frameborder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowfullscreen></iframe>
              </div>
              <div class="video-title">${escapeHtml(title)}</div>
            </div>
          </div>
        </div>
        ${SIDEBAR_JS}
      </body>
      </html>
    `);

  } catch (error) {
    console.error("Watch error:", error);
    res.send(renderError("エラー", "動画の読み込み中にエラーが発生しました"));
  }
});

// --------------------------------------
// 履歴ページ（エラーハンドリング追加）
// --------------------------------------
app.get("/history", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  try {
    const result = await pool.query(
      `SELECT query, video_id, title, created_at
       FROM history
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user]
    );

    const data = result.rows;

    let html = `
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>履歴</title>
        ${CSS}
      </head>
      <body>
        ${SIDEBAR_HTML}

        <div id="main-content" class="main-content">
          <div class="container">
            <h2>🕘 ${escapeHtml(user)} さんの検索履歴</h2>

            ${data.length > 0 ? `
              <form action="/history/delete" method="POST" style="text-align:center;margin-bottom:30px;">
                <button class="danger" style="width:auto;max-width:300px;">すべての履歴を削除</button>
              </form>
            ` : ''}

            ${data.length === 0 ? `
              <div style="text-align:center;padding:60px 20px;background:white;border-radius:16px;">
                <div style="font-size:60px;margin-bottom:20px;">📭</div>
                <p style="font-size:18px;color:#666;">まだ履歴がありません</p>
              </div>
            ` : ''}
    `;

    html += data.map((item, index) => `
      <div class="history-card">
        <div style="color:#999;font-size:14px;margin-bottom:8px;">${formatDateJP(item.created_at)}</div>
        <strong>${escapeHtml(item.query)}</strong><br>
        <a href="#" onclick="postWatch('${escapeHtml(item.video_id)}'); return false;">
          ${escapeHtml(item.title)}
        </a>
        <br><br>
        <a href="/history/delete-one?index=${index}" style="color:#f5576c;font-size:14px;">この履歴を削除</a>
      </div>
    `).join("");

    html += `
          </div>
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

  } catch (error) {
    console.error("History error:", error);
    res.send(renderError("エラー", "履歴の取得中にエラーが発生しました"));
  }
});

// --------------------------------------
// 履歴削除（全削除）
// --------------------------------------
app.post("/history/delete", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  try {
    await pool.query('DELETE FROM history WHERE user_id = $1', [user]);
    res.redirect("/history");
  } catch (error) {
    console.error("History delete error:", error);
    res.send(renderError("エラー", "履歴の削除中にエラーが発生しました", "/history"));
  }
});

// --------------------------------------
// 履歴削除（1件削除）
// --------------------------------------
app.get("/history/delete-one", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  try {
    const index = parseInt(req.query.index);
    
    // インデックスから実際のレコードを取得して削除
    const result = await pool.query(
      `SELECT id FROM history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1 OFFSET $2`,
      [user, index]
    );

    if (result.rows.length > 0) {
      await pool.query('DELETE FROM history WHERE id = $1', [result.rows[0].id]);
    }

    res.redirect("/history");
  } catch (error) {
    console.error("History delete one error:", error);
    res.send(renderError("エラー", "履歴の削除中にエラーが発生しました", "/history"));
  }
});

// --------------------------------------
// 管理者ページ
// --------------------------------------
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "jagdyufr5t62";

app.get("/admin", (req, res) => {
  const user = req.cookies.user;
  const pass = req.query.pass;

  if (!user) return res.redirect("/login");

  if (user !== "hinata") {
    return res.send(renderError("アクセス拒否", "管理者ページへのアクセス権限がありません"));
  }

  if (pass !== ADMIN_PASSWORD) {
    return res.send(`
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>管理者ログイン</title>
        ${CSS}
      </head>
      <body>
        ${SIDEBAR_HTML}

        <div id="main-content" class="main-content">
          <div class="center-box">
            <h2>管理者ログイン</h2>
            <form>
              <input name="pass" type="password" placeholder="管理者パスワード" required autocomplete="current-password">
              <button type="submit">ログイン</button>
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
  if (pass !== ADMIN_PASSWORD) {
    return res.send(renderError("認証エラー", "パスワードが間違っています", "/admin"));
  }

  try {
    const result = await pool.query(`
      SELECT user_id, query, video_id, title, created_at
      FROM history
      ORDER BY created_at DESC
    `);

    const historyByUser = {};
    for (const row of result.rows) {
      if (!historyByUser[row.user_id]) {
        historyByUser[row.user_id] = [];
      }
      historyByUser[row.user_id].push(row);
    }

    let allHistoryHTML = "";
    let deleteButtonsHTML = "";

    for (const userName in historyByUser) {
      const data = historyByUser[userName];

      allHistoryHTML += `<h3 style="color:#667eea;margin-top:30px;">${escapeHtml(userName)}</h3>`;
      allHistoryHTML += data.map(item => `
        <div class="history-card">
          <div style="color:#999;font-size:14px;margin-bottom:8px;">${formatDateJP(item.created_at)}</div>
          <strong>${escapeHtml(item.query)}</strong><br>
          <a href="#" onclick="postWatch('${escapeHtml(item.video_id)}'); return false;">
            ${escapeHtml(item.title)}
          </a>
        </div>
      `).join("");

      deleteButtonsHTML += `
        <form method="POST" action="/admin/delete-user" style="margin-bottom:15px;">
          <input type="hidden" name="user" value="${escapeHtml(userName)}">
          <input type="hidden" name="pass" value="${ADMIN_PASSWORD}">
          <button class="danger" style="width:auto;max-width:300px;">${escapeHtml(userName)} の履歴を削除</button>
        </form>
      `;
    }

    res.send(`
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>管理者ページ</title>
        ${CSS}
      </head>
      <body>
        ${SIDEBAR_HTML}

        <div id="main-content" class="main-content">
          <div class="container">
            <h2>⚙️ 管理者ページ</h2>

            <div class="tabs">
              <div class="tab active" id="tab-all" onclick="openTab('all')">全履歴</div>
              <div class="tab" id="tab-delete" onclick="openTab('delete')">ユーザー削除</div>
            </div>

            <div class="tab-content active" id="content-all">
              ${allHistoryHTML || '<p style="text-align:center;padding:40px;color:#999;">履歴がありません</p>'}
            </div>

            <div class="tab-content" id="content-delete">
              ${deleteButtonsHTML || '<p style="text-align:center;padding:40px;color:#999;">ユーザーがいません</p>'}
            </div>
          </div>
        </div>

        ${SIDEBAR_JS}

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
      </body>
      </html>
    `);

  } catch (error) {
    console.error("Admin error:", error);
    res.send(renderError("エラー", "管理者ページの読み込み中にエラーが発生しました"));
  }
});

// --------------------------------------
// 管理者：ユーザー削除
// --------------------------------------
app.post("/admin/delete-user", async (req, res) => {
  const pass = req.body.pass;
  const user = req.body.user;

  if (pass !== ADMIN_PASSWORD) {
    return res.send(renderError("認証エラー", "パスワードが間違っています", "/admin"));
  }

  try {
    await pool.query('DELETE FROM history WHERE user_id = $1', [user]);
    res.redirect(`/admin?pass=${ADMIN_PASSWORD}`);
  } catch (error) {
    console.error("Admin delete user error:", error);
    res.send(renderError("エラー", "ユーザー履歴の削除中にエラーが発生しました", `/admin?pass=${ADMIN_PASSWORD}`));
  }
});

// --------------------------------------
// ログアウト
// --------------------------------------
app.get("/logout", (req, res) => {
  res.clearCookie("user");
  res.redirect("/login");
});

// --------------------------------------
// ミュージック（外部リダイレクト）
// --------------------------------------
app.get("/music", (req, res) => {
  res.redirect("https://musicviewer.onrender.com/");
});

// --------------------------------------
// 404エラー
// --------------------------------------
app.use((req, res) => {
  res.status(404).send(renderError("ページが見つかりません", "お探しのページは存在しません"));
});

// --------------------------------------
// グローバルエラーハンドラ
// --------------------------------------
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).send(renderError("サーバーエラー", "予期しないエラーが発生しました。しばらくしてからもう一度お試しください。"));
});

// --------------------------------------
// サーバー起動
// --------------------------------------
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📱 Mobile-friendly UI enabled`);
  console.log(`🛡️ Error handling active`);
});

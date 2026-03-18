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
// 美しい青系UI（スマホ対応）
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
    background: linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%);
    background-attachment: fixed;
    min-height: 100vh;
    color: #333;
    position: relative;
  }

  /* 美しい背景アニメーション */
  body::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: 
      radial-gradient(circle at 20% 50%, rgba(52, 152, 219, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 80% 80%, rgba(41, 128, 185, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 40% 20%, rgba(93, 173, 226, 0.05) 0%, transparent 50%);
    pointer-events: none;
    z-index: 0;
  }

  h2 {
    margin-bottom: 25px;
    background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-align: center;
    font-size: 32px;
    font-weight: 700;
    letter-spacing: -0.5px;
  }

  /* ハンバーガーメニューボタン */
  .menu-toggle {
    display: none;
    position: fixed;
    top: 15px;
    left: 15px;
    z-index: 2000;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border: none;
    border-radius: 12px;
    width: 50px;
    height: 50px;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(52, 152, 219, 0.3);
    font-size: 24px;
    transition: all 0.3s ease;
  }

  .menu-toggle:hover {
    background: white;
    transform: scale(1.05);
    box-shadow: 0 6px 25px rgba(52, 152, 219, 0.4);
  }

  /* サイドバー - ガラスモーフィズム */
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    width: 75px;
    height: 100%;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-right: 1px solid rgba(52, 152, 219, 0.1);
    padding-top: 25px;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    z-index: 1000;
    box-shadow: 4px 0 30px rgba(0, 0, 0, 0.08);
  }

  .sidebar.open {
    width: 260px;
  }

  .sidebar a {
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 18px 22px;
    font-size: 16px;
    color: #2c3e50;
    text-decoration: none;
    white-space: nowrap;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border-left: 3px solid transparent;
    position: relative;
    overflow: hidden;
  }

  .sidebar a::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    width: 0;
    background: linear-gradient(90deg, rgba(52, 152, 219, 0.1) 0%, transparent 100%);
    transition: width 0.3s ease;
  }

  .sidebar a:hover::before {
    width: 100%;
  }

  .sidebar a:hover {
    color: #3498db;
    border-left-color: #3498db;
    transform: translateX(5px);
  }

  .sidebar-icon {
    font-size: 24px;
    min-width: 32px;
    text-align: center;
  }

  /* メインコンテンツ */
  .main-content {
    margin-left: 95px;
    padding: 40px 25px;
    transition: margin-left 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    min-height: 100vh;
    position: relative;
    z-index: 1;
  }

  .main-content.shift {
    margin-left: 280px;
  }

  /* カードコンテナ */
  .container {
    max-width: 1400px;
    margin: 0 auto;
  }

  /* カードグリッド */
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 28px;
    padding: 25px 0;
  }

  .card {
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(10px);
    padding: 0;
    border-radius: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.3);
    position: relative;
  }

  .card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #3498db 0%, #2980b9 100%);
    transform: scaleX(0);
    transition: transform 0.4s ease;
  }

  .card:hover::before {
    transform: scaleX(1);
  }

  .card:hover {
    transform: translateY(-12px) scale(1.02);
    box-shadow: 0 20px 60px rgba(52, 152, 219, 0.25);
  }

  .card img.thumb {
    width: 100%;
    height: 200px;
    object-fit: cover;
    display: block;
    transition: transform 0.4s ease;
  }

  .card:hover img.thumb {
    transform: scale(1.05);
  }

  .card-content {
    padding: 18px;
  }

  .card-title {
    font-weight: 600;
    font-size: 16px;
    line-height: 1.5;
    color: #2c3e50;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* 中央ボックス（ログインなど） */
  .center-box {
    max-width: 460px;
    margin: 100px auto;
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(20px);
    padding: 50px;
    border-radius: 24px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .center-box h2 {
    margin-bottom: 35px;
  }

  /* 検索ボックス */
  .search-box {
    max-width: 850px;
    margin: 0 auto 50px;
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(20px);
    padding: 40px;
    border-radius: 24px;
    box-shadow: 0 15px 50px rgba(0, 0, 0, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  /* フォーム要素 */
  input[type="text"],
  input[type="password"],
  select,
  .region-select {
    width: 100%;
    padding: 16px 20px;
    font-size: 16px;
    border-radius: 12px;
    border: 2px solid rgba(52, 152, 219, 0.2);
    margin-bottom: 18px;
    background: rgba(255, 255, 255, 0.9);
    transition: all 0.3s ease;
    font-family: inherit;
  }

  input:focus,
  select:focus {
    outline: none;
    border-color: #3498db;
    box-shadow: 0 0 0 4px rgba(52, 152, 219, 0.15);
    background: white;
  }

  button {
    width: 100%;
    padding: 16px 20px;
    font-size: 17px;
    font-weight: 600;
    border-radius: 12px;
    border: none;
    cursor: pointer;
    background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
    color: white;
    transition: all 0.3s ease;
    font-family: inherit;
    box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3);
    position: relative;
    overflow: hidden;
  }

  button::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
    transition: left 0.5s ease;
  }

  button:hover::before {
    left: 100%;
  }

  button:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(52, 152, 219, 0.4);
  }

  button:active {
    transform: translateY(-1px);
  }

  button.danger {
    background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
    box-shadow: 0 4px 15px rgba(231, 76, 60, 0.3);
  }

  button.danger:hover {
    box-shadow: 0 8px 25px rgba(231, 76, 60, 0.4);
  }

  /* 履歴カード */
  .history-card {
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(10px);
    padding: 25px;
    margin-bottom: 18px;
    border-radius: 16px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    border-left: 5px solid #3498db;
    transition: all 0.3s ease;
  }

  .history-card:hover {
    transform: translateX(8px);
    box-shadow: 0 6px 30px rgba(52, 152, 219, 0.2);
  }

  .history-card strong {
    color: #3498db;
    font-size: 17px;
  }

  .history-card a {
    color: #2c3e50;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .history-card a:hover {
    color: #3498db;
    text-decoration: underline;
  }

  /* エラーページ */
  .error-container {
    max-width: 650px;
    margin: 120px auto;
    text-align: center;
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(20px);
    padding: 60px;
    border-radius: 24px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .error-icon {
    font-size: 90px;
    margin-bottom: 25px;
    filter: drop-shadow(0 4px 10px rgba(0,0,0,0.1));
  }

  .error-title {
    font-size: 36px;
    background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 18px;
    font-weight: 700;
  }

  .error-message {
    font-size: 18px;
    color: #555;
    margin-bottom: 35px;
    line-height: 1.7;
  }

  .error-link {
    display: inline-block;
    padding: 14px 35px;
    background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
    color: white;
    text-decoration: none;
    border-radius: 12px;
    font-weight: 600;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3);
  }

  .error-link:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(52, 152, 219, 0.4);
  }

  /* ローディング */
  .loading {
    text-align: center;
    padding: 50px;
    font-size: 19px;
    color: #3498db;
  }

  .spinner {
    border: 5px solid rgba(52, 152, 219, 0.1);
    border-top: 5px solid #3498db;
    border-radius: 50%;
    width: 60px;
    height: 60px;
    animation: spin 1s linear infinite;
    margin: 25px auto;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* タブ（管理者ページ用） */
  .tabs {
    display: flex;
    gap: 12px;
    margin-bottom: 35px;
    border-bottom: 2px solid rgba(52, 152, 219, 0.2);
  }

  .tab {
    padding: 14px 28px;
    cursor: pointer;
    border-bottom: 3px solid transparent;
    transition: all 0.3s ease;
    font-weight: 600;
    color: #7f8c8d;
    border-radius: 8px 8px 0 0;
  }

  .tab:hover {
    color: #3498db;
    background: rgba(52, 152, 219, 0.05);
  }

  .tab.active {
    color: #3498db;
    border-bottom-color: #3498db;
    background: rgba(52, 152, 219, 0.08);
  }

  .tab-content {
    display: none;
  }

  .tab-content.active {
    display: block;
    animation: fadeIn 0.4s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* レスポンシブデザイン */
  @media (max-width: 768px) {
    .menu-toggle {
      display: block;
    }

    .sidebar {
      width: 0;
      transform: translateX(-100%);
      padding-top: 75px;
    }

    .sidebar.open {
      width: 85%;
      max-width: 300px;
      transform: translateX(0);
    }

    .main-content {
      margin-left: 0;
      padding: 90px 18px 35px;
    }

    .main-content.shift {
      margin-left: 0;
    }

    .card-grid {
      grid-template-columns: 1fr;
      gap: 20px;
    }

    .center-box {
      margin: 50px 18px;
      padding: 35px 25px;
    }

    .search-box {
      padding: 25px;
      margin-bottom: 35px;
    }

    h2 {
      font-size: 26px;
    }

    .error-container {
      margin: 60px 18px;
      padding: 40px 25px;
    }

    .error-icon {
      font-size: 70px;
    }

    .error-title {
      font-size: 28px;
    }
  }

  @media (min-width: 769px) and (max-width: 1024px) {
    .card-grid {
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    }
  }

  /* ダークモード対応 */
  @media (prefers-color-scheme: dark) {
    body {
      background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #1e2a3a 100%);
    }

    .sidebar {
      background: rgba(30, 39, 58, 0.95);
      border-right-color: rgba(52, 152, 219, 0.2);
    }

    .sidebar a {
      color: #cbd5e0;
    }

    .sidebar a:hover {
      color: #5dade2;
    }

    .card,
    .center-box,
    .search-box,
    .history-card,
    .error-container {
      background: rgba(30, 39, 58, 0.95);
      border-color: rgba(52, 152, 219, 0.2);
    }

    .card-title {
      color: #e8edf2;
    }

    h2 {
      background: linear-gradient(135deg, #5dade2 0%, #3498db 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    input,
    select {
      background: rgba(20, 29, 48, 0.7);
      border-color: rgba(52, 152, 219, 0.3);
      color: #e8edf2;
    }

    input:focus,
    select:focus {
      background: rgba(20, 29, 48, 0.9);
      border-color: #5dade2;
    }

    .menu-toggle {
      background: rgba(30, 39, 58, 0.95);
      color: #e8edf2;
    }

    .error-message,
    .history-card a {
      color: #cbd5e0;
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
  console.log(`\n╔═══════════════════════════════════════╗`);
  console.log(`║  🌊 サーバー起動成功                  ║`);
  console.log(`╠═══════════════════════════════════════╣`);
  console.log(`║  🌐 ポート: ${PORT.toString().padEnd(24)}║`);
  console.log(`║  📱 レスポンシブUI: 有効              ║`);
  console.log(`║  🛡️  安全機能: 有効                    ║`);
  console.log(`║  💎 美しい青系デザイン: 適用済み      ║`);
  console.log(`╚═══════════════════════════════════════╝\n`);
});

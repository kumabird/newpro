import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();
app.disable("x-powered-by");

const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.json());

import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ======================================
// ■ CSS（プラットフォームごとにアクセントカラーを切り替え）
// ======================================
function buildCSS(platform = "yt") {
  const isNico = platform === "nico";
  const accent      = isNico ? "#e6242b" : "#ff0000";
  const accentDark  = isNico ? "#c41e24" : "#cc0000";
  const accentLight = isNico ? "#fff0f0" : "#fff5f5";
  const bgColor     = isNico ? "#fff8f8" : "#f0f6ff";

  return `
<style>
  :root {
    --accent:       ${accent};
    --accent-dark:  ${accentDark};
    --accent-light: ${accentLight};
    --bg:           ${bgColor};
  }

  * { box-sizing: border-box; }

  body {
    font-family: "Segoe UI", sans-serif;
    background: var(--bg);
    margin: 0; padding: 0; color: #333;
  }

  h2 { margin-bottom: 20px; color: #2c3e50; text-align: center; }

  /* ── サイドバー ── */
  .sidebar {
    position: fixed;
    top: 0; left: 0;
    width: 54px;
    height: 100%;
    background: #1a1a2e;
    padding-top: 0;
    transition: width 0.25s ease;
    overflow: hidden;
    z-index: 1000;
    display: flex;
    flex-direction: column;
  }
  .sidebar.open { width: 230px; }

  /* プラットフォームスイッチャー */
  .platform-switcher {
    padding: 8px 5px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .platform-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 9px;
    border-radius: 8px;
    cursor: pointer;
    border: none;
    background: transparent;
    color: rgba(255,255,255,0.5);
    font-size: 13px;
    font-weight: bold;
    white-space: nowrap;
    width: 100%;
    transition: background 0.18s, color 0.18s;
    text-align: left;
  }
  .platform-btn .p-icon {
    font-size: 20px;
    flex-shrink: 0;
    width: 28px;
    text-align: center;
  }
  .platform-btn .p-label { opacity: 0; transition: opacity 0.2s; }
  .sidebar.open .platform-btn .p-label { opacity: 1; }

  .platform-btn.yt-btn.active   { background: #ff0000; color: white; }
  .platform-btn.nico-btn.active { background: #e6242b; color: white; }
  .platform-btn.yt-btn:not(.active):hover   { background: rgba(255,0,0,0.2); color: white; }
  .platform-btn.nico-btn:not(.active):hover { background: rgba(230,36,43,0.2); color: white; }

  /* ナビリンク */
  .sidebar-nav { flex: 1; overflow-y: auto; padding: 6px 5px; }

  .sidebar a {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 9px;
    font-size: 14px;
    color: rgba(255,255,255,0.7);
    text-decoration: none;
    white-space: nowrap;
    border-radius: 8px;
    margin-bottom: 2px;
    transition: background 0.18s, color 0.18s;
  }
  .sidebar a:hover       { background: rgba(255,255,255,0.1); color: white; }
  .sidebar a.active-link { background: rgba(255,255,255,0.15); color: white; }

  .sidebar-icon {
    font-size: 19px;
    flex-shrink: 0;
    width: 28px;
    text-align: center;
  }
  .sidebar-text { opacity: 0; transition: opacity 0.2s; }
  .sidebar.open .sidebar-text { opacity: 1; }

  .sidebar-divider {
    border: none;
    border-top: 1px solid rgba(255,255,255,0.1);
    margin: 5px 4px;
  }

  .sidebar-footer {
    padding: 6px 5px 10px;
    border-top: 1px solid rgba(255,255,255,0.1);
    flex-shrink: 0;
  }

  /* ── メインコンテンツ ── */
  .main-content {
    margin-left: 74px;
    padding: 24px;
    transition: margin-left 0.25s ease;
    min-height: 100vh;
  }
  .main-content.shift { margin-left: 250px; }

  /* ── カード ── */
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
  }
  .card {
    background: white;
    padding: 12px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .card:hover { transform: translateY(-3px); box-shadow: 0 6px 18px rgba(0,0,0,0.13); }
  .card.nico-card { border-top: 3px solid #e6242b; }
  .card.yt-card   { border-top: 3px solid #ff0000; }

  .thumb {
    width: 100%; border-radius: 8px;
    aspect-ratio: 16/9; object-fit: cover;
    background: #eee; display: block;
  }

  /* ── フォーム ── */
  .center-box {
    max-width: 380px; margin: 80px auto;
    background: white; padding: 30px;
    border-radius: 14px; box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  }

  input[type=text], input[type=password], select.form-select {
    width: 100%; padding: 12px 14px;
    font-size: 15px; border-radius: 8px;
    border: 1px solid #ccc; margin-bottom: 12px;
    background: white; display: block;
  }
  input[type=text]:focus, input[type=password]:focus, select.form-select:focus {
    outline: none; border-color: var(--accent);
  }

  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 10px 16px; font-size: 13px; font-weight: bold;
    border-radius: 8px; border: none; cursor: pointer;
    text-decoration: none; transition: opacity 0.15s; margin-bottom: 8px;
  }
  .btn:hover { opacity: 0.85; }
  .btn-primary { background: var(--accent); color: white; }
  .btn-gray    { background: #95a5a6; color: white; }
  .btn-yellow  { background: #f1c40f; color: #333; }
  .btn-danger  { background: #e74c3c; color: white; }
  .btn-green   { background: #27ae60; color: white; }
  .btn-full    { width: 100%; justify-content: center; }

  /* 検索ボックス */
  .search-wrap {
    max-width: 700px; margin: 0 auto 24px;
    background: white; border-radius: 14px;
    padding: 24px 28px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  }

  /* ページヘッダー */
  .page-header {
    display: flex; align-items: center; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;
  }
  .page-header h2 { margin: 0; text-align: left; font-size: 20px; }

  .platform-badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 10px; border-radius: 20px;
    font-size: 12px; font-weight: bold; color: white;
  }
  .platform-badge.yt   { background: #ff0000; }
  .platform-badge.nico { background: #e6242b; }

  /* 視聴ページ */
  .watch-layout {
    display: flex; gap: 24px; max-width: 1280px; margin: 0 auto; align-items: flex-start;
  }
  .watch-player { flex: 1; min-width: 0; }
  .watch-player video { width:100%; aspect-ratio:16/9; border-radius:12px; background:#000; }
  .iframe-wrap { position:relative; width:100%; aspect-ratio:16/9; }
  .iframe-wrap iframe {
    position:absolute; top:0; left:0; width:100%; height:100%;
    border-radius:12px; border:none; background:#000;
  }
  .watch-related { width:360px; flex-shrink:0; max-height:90vh; overflow-y:auto; }
  .watch-related h3 { font-size:13px; margin-bottom:12px; color:#888; }
  .action-bar { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px; }
  .channel-info { font-size:14px; color:#555; margin:8px 0 12px; cursor:pointer; }
  .channel-info:hover { color: var(--accent); }
  @media (max-width:900px) { .watch-layout { flex-direction:column; } .watch-related { width:100%; } }

  /* 設定 */
  .settings-box {
    max-width:540px; margin:0 auto;
    background:white; padding:32px;
    border-radius:14px; box-shadow:0 4px 16px rgba(0,0,0,0.1);
  }
  .mode-card {
    border:2px solid #ddd; border-radius:10px;
    padding:14px 18px; margin-bottom:12px;
    cursor:pointer; transition:border-color 0.2s, background 0.2s;
  }
  .mode-card:hover  { border-color:var(--accent); background:var(--accent-light); }
  .mode-card.selected { border-color:var(--accent); background:var(--accent-light); }
  .mode-card label { display:flex; align-items:flex-start; gap:10px; cursor:pointer; }
  .mode-card input[type=radio] { width:auto; margin:3px 0 0; flex-shrink:0; }
  .mode-card strong { display:block; font-size:15px; margin-bottom:4px; color:#2c3e50; }
  .mode-card p { margin:0; font-size:13px; color:#666; line-height:1.5; }
  .current-badge {
    display:inline-block; background:var(--accent); color:white;
    font-size:11px; padding:2px 8px; border-radius:20px; margin-left:8px; vertical-align:middle;
  }

  /* 履歴 */
  .history-card {
    background:white; border-radius:10px; padding:12px; margin-bottom:8px;
    display:flex; gap:12px; align-items:center;
    box-shadow:0 1px 4px rgba(0,0,0,0.07);
  }
  .history-card img {
    width:120px; height:68px; border-radius:8px;
    object-fit:cover; flex-shrink:0; background:#eee;
  }

  /* 管理者 */
  .tabs { display:flex; gap:8px; margin-bottom:20px; }
  .tab {
    padding:10px 20px; border-radius:8px;
    cursor:pointer; background:#eee; font-weight:bold; border:none; font-size:14px;
  }
  .tab.active { background:var(--accent); color:white; }
  .tab-content { display:none; }
  .tab-content.active { display:block; }

  .badge-nico { display:inline-block; background:#e6242b; color:white; font-size:10px; padding:1px 5px; border-radius:3px; margin-left:4px; font-weight:bold; }
  .badge-yt   { display:inline-block; background:#ff0000; color:white; font-size:10px; padding:1px 5px; border-radius:3px; margin-left:4px; font-weight:bold; }

  /* ランキングバッジ */
  .rank-badge {
    position:absolute; top:8px; left:8px;
    background:var(--accent); color:white;
    font-weight:bold; font-size:13px;
    padding:2px 8px; border-radius:6px;
  }
</style>
`;
}

// ======================================
// ■ サイドバー HTML
// ======================================
function buildSidebar(platform, currentPath = "") {
  const isNico = platform === "nico";
  const al = (p) => currentPath === p ? ' class="active-link"' : '';

  const ytLinks = `
    <a href="/"${al("/")}><span class="sidebar-icon">🏠</span><span class="sidebar-text">ホーム</span></a>
    <a href="/channel-search"${al("/channel-search")}><span class="sidebar-icon">📺</span><span class="sidebar-text">チャンネル検索</span></a>
    <a href="/music"><span class="sidebar-icon">♫</span><span class="sidebar-text">Music</span></a>
    <hr class="sidebar-divider">
    <a href="/favorites"${al("/favorites")}><span class="sidebar-icon">⭐</span><span class="sidebar-text">お気に入り</span></a>
    <a href="/history"${al("/history")}><span class="sidebar-icon">🕘</span><span class="sidebar-text">履歴</span></a>
    <a href="/settings"${al("/settings")}><span class="sidebar-icon">⚙️</span><span class="sidebar-text">設定</span></a>
    <a href="/admin"><span class="sidebar-icon">🛡️</span><span class="sidebar-text">管理者ページ</span></a>
  `;

  const nicoLinks = `
    <a href="/nico"${al("/nico")}><span class="sidebar-icon">🏠</span><span class="sidebar-text">ホーム</span></a>
    <a href="/nico/ranking"${al("/nico/ranking")}><span class="sidebar-icon">🏆</span><span class="sidebar-text">ランキング</span></a>
    <hr class="sidebar-divider">
    <a href="/favorites"${al("/favorites")}><span class="sidebar-icon">⭐</span><span class="sidebar-text">お気に入り</span></a>
    <a href="/history"${al("/history")}><span class="sidebar-icon">🕘</span><span class="sidebar-text">履歴</span></a>
    <a href="/admin"><span class="sidebar-icon">🛡️</span><span class="sidebar-text">管理者ページ</span></a>
  `;

  return `
<div id="sidebar" class="sidebar">
  <div class="platform-switcher">
    <button class="platform-btn yt-btn${!isNico ? " active" : ""}" onclick="switchPlatform('yt')">
      <span class="p-icon">▶</span><span class="p-label">YouTube</span>
    </button>
    <button class="platform-btn nico-btn${isNico ? " active" : ""}" onclick="switchPlatform('nico')">
      <span class="p-icon">🎬</span><span class="p-label">ニコニコ動画</span>
    </button>
  </div>
  <div class="sidebar-nav">
    ${isNico ? nicoLinks : ytLinks}
  </div>
  <div class="sidebar-footer">
    <a href="/logout"><span class="sidebar-icon">🚪</span><span class="sidebar-text">ログアウト</span></a>
  </div>
</div>
`;
}

// ======================================
// ■ 共通JS・ページビルダー
// ======================================
const SIDEBAR_JS = `
<script>
const sidebar = document.getElementById("sidebar");
const main    = document.getElementById("main-content");
sidebar.addEventListener("mouseenter", () => { sidebar.classList.add("open"); if(main) main.classList.add("shift"); });
sidebar.addEventListener("mouseleave", () => { sidebar.classList.remove("open"); if(main) main.classList.remove("shift"); });
function switchPlatform(p) {
  document.cookie = "platform=" + p + "; path=/; max-age=31536000";
  location.href = (p === "nico") ? "/nico" : "/";
}
</script>
`;

const CHANNEL_NAV_JS = `
<script>
function goChannel(id) {
  const f=document.createElement("form"); f.method="POST"; f.action="/channel-videos";
  const i=document.createElement("input"); i.type="hidden"; i.name="id"; i.value=id;
  f.appendChild(i); document.body.appendChild(f); f.submit();
}
</script>
`;

const WATCH_NAV_JS = `
<script>
function postWatch(id){const f=document.createElement("form");f.method="POST";f.action="/watch";const i=document.createElement("input");i.type="hidden";i.name="id";i.value=id;f.appendChild(i);document.body.appendChild(f);f.submit();}
function postNicoWatch(id){const f=document.createElement("form");f.method="POST";f.action="/nico/watch";const i=document.createElement("input");i.type="hidden";i.name="id";i.value=id;f.appendChild(i);document.body.appendChild(f);f.submit();}
</script>
`;

function page(title, platform, body, currentPath = "", extraJS = "") {
  let fixedTitle = "Video Viewer";

  if (platform === "yt") fixedTitle = "YouTube Viewer";
  if (platform === "nico") fixedTitle = "Niconico Viewer";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${fixedTitle}</title>
${buildCSS(platform)}
</head>
<body>
${buildSidebar(platform, currentPath)}
<div id="main-content" class="main-content">
${body}
</div>
${SIDEBAR_JS}
${extraJS}
</body>
</html>`;
}

// ======================================
// ■ ユーティリティ
// ======================================

// 管理者は環境変数から読み込む（users.jsonは廃止）
const ADMIN_USER = process.env.ADMIN_USER || "hinata";
const ADMIN_PASS = process.env.ADMIN_PASS || "changeme_admin";

async function findUser(user, pass) {
  // 管理者は環境変数で照合
  if (user === ADMIN_USER) {
    return pass === ADMIN_PASS ? { user, isAdmin: true } : null;
  }
  // 一般ユーザーはDBから照合
  try {
    const result = await pool.query(
      "SELECT username FROM users WHERE username=$1 AND password=$2",
      [user, pass]
    );
    return result.rows.length > 0 ? { user, isAdmin: false } : null;
  } catch (e) {
    console.error("DB findUser error:", e);
    return null;
  }
}

async function ensureUsersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      reg_ip TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // 既存テーブルにカラムがなければ追加
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reg_ip TEXT`);
}
ensureUsersTable().catch(console.error);

function getPlatform(req) {
  return req.cookies.platform === "nico" ? "nico" : "yt";
}

async function saveHistory(user, keyword, videoId, title, source = "yt") {
  const storedId = source === "nico" ? `nico:${videoId}` : videoId;
  const params = [user, keyword, storedId, title];
  await Promise.allSettled([
    pool.query("INSERT INTO history (user_id, query, video_id, title) VALUES ($1,$2,$3,$4)", params),
    pool.query("INSERT INTO admin_history (user_id, query, video_id, title) VALUES ($1,$2,$3,$4)", params)
  ]);
}

function formatDateJP(date) {
  const d = new Date(date);
  const wk = ["日","月","火","水","木","金","土"];
  return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} `
       + `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`
       + ` (${wk[d.getDay()]}曜)`;
}

function getThumbUrl(videoId, size = "mq") {
  if (videoId.startsWith("nico:")) {
    const numId = videoId.replace("nico:", "").replace(/^[a-zA-Z]+/, "");
    return `https://nicovideo.cdn.nimg.jp/thumbnails/${numId}/${numId}`;
  }
  const map = { hq: "hqdefault", mq: "mqdefault", max: "maxresdefault" };
  return `https://i.ytimg.com/vi/${videoId}/${map[size]||"mqdefault"}.jpg`;
}

// ======================================
// ■ ログイン / ログアウト
// ======================================
app.get("/login", (req, res) => {
  const msg = req.query.msg
    ? `<p style="color:#e74c3c;text-align:center;font-size:14px;">${req.query.msg}</p>`
    : "";
  res.send(`<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>ログイン</title>${buildCSS("yt")}</head><body>
<div class="center-box">
  <h2>🎬 ログイン</h2>
  ${msg}
  <form method="POST" action="/login">
    <input type="text"     name="user" placeholder="ユーザー名" required>
    <input type="password" name="pass" placeholder="パスワード"   required>
    <button class="btn btn-primary btn-full" type="submit">ログイン</button>
  </form>
  <div style="text-align:center;margin-top:18px;padding-top:16px;border-top:1px solid #eee;">
    <p style="font-size:13px;color:#888;margin-bottom:10px;">アカウントをまだお持ちでないですか？</p>
    <a href="/signup" class="btn btn-green btn-full">📝 新規アカウント登録</a>
  </div>
</div>
</body></html>`);
});

app.post("/login", async (req, res) => {
  const { user, pass } = req.body;
  const found = await findUser(user, pass);
  if (!found) return res.redirect("/login?msg=" + encodeURIComponent("ユーザー名またはパスワードが違います"));
  res.cookie("user", user, { httpOnly: true });
  res.redirect("/");
});

app.get("/logout", (req, res) => {
  res.clearCookie("user");
  res.redirect("/login");
});

// ======================================
// ■ サインアップ
// ======================================
app.get("/signup", (req, res) => {
  const msg = req.query.msg
    ? `<p style="color:#e74c3c;text-align:center;font-size:14px;">${req.query.msg}</p>`
    : "";
  res.send(`<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>アカウント登録</title>${buildCSS("yt")}</head><body>
<div style="max-width:480px;margin:40px auto;background:white;padding:30px;border-radius:14px;box-shadow:0 4px 16px rgba(0,0,0,0.12);">
  <h2 style="text-align:center;color:#2c3e50;">📝 アカウント登録</h2>
  ${msg}

  <!-- 利用規約 -->
  <div style="border:1px solid #ddd;border-radius:10px;padding:16px;margin-bottom:20px;background:#fafafa;">
    <h3 style="font-size:15px;margin-top:0;color:#2c3e50;">📋 利用規約</h3>
    <div style="height:220px;overflow-y:auto;font-size:13px;line-height:1.8;color:#555;padding-right:6px;">
      <p><strong>第1条（本サービスについて）</strong><br>
      本サービスは、YouTube・ニコニコ動画の動画を閲覧するためのプライベートビューアです。管理者の承認のもと、招待されたユーザーのみが利用できます。</p>

      <p><strong>第2条（履歴の記録・監視）</strong><br>
      本サービスでは、ユーザーの視聴履歴（閲覧した動画のタイトル・動画ID・検索キーワード・日時）を自動的に記録します。記録された履歴は管理者が閲覧・管理できます。ユーザー自身が履歴を削除した後も、管理者用の記録は保持されます。</p>

      <p><strong>第3条（禁止事項）</strong><br>
      以下の行為を禁止します。<br>
      ・アカウント情報の第三者への共有・譲渡<br>
      ・本サービスへの不正アクセスや改ざん<br>
      ・サービスの安定運用を妨げる行為</p>

      <p><strong>第4条（アカウントの停止）</strong><br>
      管理者は、利用規約に違反したと判断した場合、予告なくアカウントを停止することができます。</p>

      <p><strong>第5条（免責事項）</strong><br>
      本サービスの利用によって生じた損害について、運営者は一切の責任を負いません。</p>

      <p><strong>第6条（規約の変更）</strong><br>
      本規約はサービスの運営上必要に応じて変更されることがあります。</p>
    </div>
  </div>

  <!-- 同意チェック -->
  <label style="display:flex;align-items:flex-start;gap:10px;font-size:13px;color:#555;margin-bottom:20px;cursor:pointer;">
    <input type="checkbox" id="agree-check" style="width:auto;margin-top:2px;flex-shrink:0;" onchange="document.getElementById('signup-btn').disabled=!this.checked;">
    <span>上記の利用規約を読み、内容に同意します（視聴履歴が管理者に記録・監視されることを含む）</span>
  </label>

  <!-- 登録フォーム -->
  <form method="POST" action="/signup">
    <input type="text"     name="user" placeholder="ユーザー名（半角英数字）" required
           style="width:100%;padding:12px 14px;font-size:15px;border-radius:8px;border:1px solid #ccc;margin-bottom:12px;box-sizing:border-box;">
    <input type="password" name="pass" placeholder="パスワード（6文字以上）" required
           style="width:100%;padding:12px 14px;font-size:15px;border-radius:8px;border:1px solid #ccc;margin-bottom:12px;box-sizing:border-box;">
    <input type="password" name="pass2" placeholder="パスワード（確認）" required
           style="width:100%;padding:12px 14px;font-size:15px;border-radius:8px;border:1px solid #ccc;margin-bottom:16px;box-sizing:border-box;">
    <button id="signup-btn" class="btn btn-green btn-full" type="submit" disabled
            style="display:flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:12px;font-size:15px;font-weight:bold;border-radius:8px;border:none;cursor:pointer;background:#27ae60;color:white;opacity:0.5;transition:opacity 0.2s;">
      ✅ 同意して登録
    </button>
  </form>
  <div style="text-align:center;margin-top:16px;">
    <a href="/login" style="font-size:13px;color:#888;">← ログインに戻る</a>
  </div>
</div>
<style>
  #signup-btn:not(:disabled) { opacity: 1 !important; }
</style>
</body></html>`);
});

app.post("/signup", async (req, res) => {
  const { user, pass, pass2 } = req.body;
  const redirect = (msg) => res.redirect("/signup?msg=" + encodeURIComponent(msg));

  if (!user || !pass || !pass2) return redirect("全ての項目を入力してください");
  if (!/^[a-zA-Z0-9_]{1,30}$/.test(user)) return redirect("ユーザー名は半角英数字・アンダースコアのみ（30文字以内）");
  if (user === ADMIN_USER) return redirect("そのユーザー名は使用できません");
  if (pass.length < 6) return redirect("パスワードは6文字以上にしてください");
  if (pass !== pass2) return redirect("パスワードが一致しません");

  // IPアドレス取得（Renderなどリバースプロキシ経由を考慮）
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();

  try {
    // 同じIPから既に登録済みか確認
    const ipCheck = await pool.query("SELECT username FROM users WHERE reg_ip=$1", [ip]);
    if (ipCheck.rows.length > 0) {
      return redirect(`このネットワークからは既にアカウント（${ipCheck.rows[0].username}）が登録されています`);
    }

    await pool.query(
      "INSERT INTO users (username, password, reg_ip) VALUES ($1, $2, $3)",
      [user, pass, ip]
    );
    res.redirect("/login?msg=" + encodeURIComponent("アカウントを作成しました。ログインしてください"));
  } catch (e) {
    if (e.code === "23505") return redirect("そのユーザー名は既に使用されています");
    console.error("signup error:", e);
    return redirect("登録に失敗しました。しばらく後にお試しください");
  }
});

// ======================================
// ■ YouTube ホーム
// ======================================
app.get("/", (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  const body = `
<div class="search-wrap">
  <div class="page-header" style="margin-bottom:16px;">
    <h2>動画を検索</h2>
    <span class="platform-badge yt">▶ YouTube</span>
  </div>
  <form action="/search" method="post">
    <input type="text" name="q" placeholder="キーワードを入力...">
    <select name="region" class="form-select">
      <option value="jp">🇯🇵 日本のみ</option>
      <option value="global">🌏 全世界</option>
    </select>
    <button class="btn btn-primary btn-full" type="submit">🔍 検索</button>
  </form>
</div>
`;
  res.send(page("YouTube - 動画検索", "yt", body, "/"));
});

// ======================================
// ■ ニコニコ ホーム
// ======================================
app.get("/nico", (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  const body = `
<div class="search-wrap">
  <div class="page-header" style="margin-bottom:16px;">
    <h2>動画を検索</h2>
    <span class="platform-badge nico">🎬 ニコニコ動画</span>
  </div>
  <form action="/nico/search" method="post">
    <input type="text" name="q" placeholder="キーワードを入力...">
    <select name="sort" class="form-select">
      <option value="-viewCounter">👁 再生数順</option>
      <option value="-commentCounter">💬 コメント数順</option>
      <option value="-mylistCounter">📋 マイリスト順</option>
      <option value="-startTime">🆕 投稿日時順（新しい）</option>
    </select>
    <button class="btn btn-primary btn-full" type="submit">🔍 検索</button>
  </form>
</div>
<div style="text-align:center;">
  <a href="/nico/ranking" class="btn btn-primary">🏆 ランキングを見る</a>
</div>
`;
  res.send(page("ニコニコ動画 - 検索", "nico", body, "/nico"));
});

// ======================================
// ■ Invidious / YouTube ストリーム
// ======================================
let invidiousApis = null;

async function getInvidiousApis() {
  try {
    const res = await fetch("https://raw.githubusercontent.com/wakame02/wktopu/refs/heads/main/inv.json", { signal: AbortSignal.timeout(5000) });
    invidiousApis = await res.json();
  } catch (e) {
    console.error("Invidiousリスト取得失敗:", e);
    invidiousApis = [];
  }
}
getInvidiousApis();

async function ggvideo(videoId) {
  const t0 = Date.now();
  for (let i = 0; i < 20; i++) { if (Math.floor(Math.random()*20)===0) await getInvidiousApis(); }
  if (!invidiousApis || !invidiousApis.length) await getInvidiousApis();
  if (!invidiousApis || !invidiousApis.length) throw new Error("APIリストが取得できません");
  for (const inst of invidiousApis) {
    try {
      const res = await fetch(`${inst}/api/v1/videos/${videoId}`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error("bad status");
      const data = await res.json();
      if (data?.formatStreams) return data;
    } catch (e) { console.error(`失敗: ${inst} - ${e.message}`); }
    if (Date.now()-t0 >= 10000) throw new Error("タイムアウト");
  }
  throw new Error("動画を取得する方法が見つかりません");
}

async function getYouTube(videoId) {
  const info = await ggvideo(videoId);
  const fmt = info.formatStreams || [];
  const adp = info.adaptiveFormats || [];
  return {
    streamUrl:   [...fmt].reverse().map(s=>s.url)[0],
    audioUrl:    adp.filter(s=>s.container==="m4a"&&s.audioQuality==="AUDIO_QUALITY_MEDIUM").map(s=>s.url)[0]||null,
    videoId,
    channelId:   info.authorId||"",
    channelName: info.author||"",
    title:       info.title||"タイトル不明",
    related:     (info.recommendedVideos||[]).slice(0,20).map(v=>({id:v.videoId,title:v.title}))
  };
}

let cachedEduParams = null;
async function getEduParams() {
  if (cachedEduParams) return cachedEduParams;
  for (const url of [
    "https://raw.githubusercontent.com/wakame02/wktopu/refs/heads/main/edu.text",
    "https://gitlab.com/wer02/wktopu/-/raw/main/edu.text"
  ]) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) { cachedEduParams = await res.text(); setTimeout(()=>{cachedEduParams=null;},5*60*1000); return cachedEduParams; }
    } catch (e) { /* 続行 */ }
  }
  return "";
}

// ======================================
// ■ YouTube 検索結果
// ======================================
app.post("/search", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");
  const q = req.body.q, region = req.body.region || "jp";
  if (!q) return res.send("検索ワードがありません");

  const url = region === "global"
    ? `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
    : `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&gl=JP&hl=ja`;

  const html = await fetch(url).then(r=>r.text());
  const matches = [...html.matchAll(/"videoId":"(.*?)".*?"title":\{"runs":\[\{"text":"(.*?)"\}\]/gs)];
  const videos = matches.slice(0,60).map(m=>({id:m[1],title:m[2]}));

  const cards = videos.map(v=>`
    <form action="/watch" method="post">
      <input type="hidden" name="id" value="${v.id}">
      <button style="all:unset;cursor:pointer;width:100%;">
        <div class="card yt-card">
          <img class="thumb" src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg">
          <div style="margin-top:8px;font-size:13px;font-weight:bold;line-height:1.4;">${v.title}</div>
        </div>
      </button>
    </form>
  `).join("");

  const body = `
<div class="page-header" style="margin-bottom:18px;">
  <h2 style="font-size:18px;">「${q}」の検索結果</h2>
  <span class="platform-badge yt">▶ YouTube</span>
  <span style="font-size:13px;color:#999;margin-left:auto;">${region==="jp"?"🇯🇵 日本":"🌏 全世界"} / ${videos.length}件</span>
</div>
<div class="card-grid">${cards}</div>
`;
  res.send(page(`${q} - YouTube検索`, "yt", body, "/"));
});

// ======================================
// ■ YouTube 視聴
// ======================================
app.post("/watch", async (req, res) => {
  const id = req.body.id;
  if (!id) return res.send("動画IDがありません");
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) return res.send("動画IDが正しくありません");
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");
  const mode = req.cookies.playbackMode || "normal";
  if (mode === "edu" || mode === "nocookie") return handleEmbedWatch(res, id, mode, user);
  return handleNormalWatch(req, res, id);
});

function buildRelatedHTML(related) {
  if (!related.length) return `<p style="color:#999;font-size:13px;">関連動画がありません</p>`;
  return related.map(v=>`
    <form action="/watch" method="post" style="display:block;margin-bottom:10px;">
      <input type="hidden" name="id" value="${v.id}">
      <button style="all:unset;cursor:pointer;width:100%;">
        <div style="display:flex;gap:8px;align-items:flex-start;">
          <img src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg"
               style="width:130px;height:73px;border-radius:6px;object-fit:cover;flex-shrink:0;background:#eee;">
          <div style="font-size:12px;font-weight:bold;line-height:1.4;color:#333;">${v.title}</div>
        </div>
      </button>
    </form>
  `).join("");
}

const FAV_SCRIPT = `
<script>
function addFav(id, title) {
  fetch("/favorite/add",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({videoId:id,title:title})})
  .then(r=>r.json()).then(d=>{
    if(d.ok)alert("お気に入りに追加しました");
    else if(d.duplicate)alert("すでに登録済みです");
    else alert("エラーが発生しました");
  }).catch(()=>alert("通信エラー"));
}
</script>
`;

async function handleNormalWatch(req, res, id) {
  const user = req.cookies.user;
  let data;
  try { data = await getYouTube(id); }
  catch (e) { return res.redirect(`https://www.youtube.com/watch?v=${id}`); }
  const { streamUrl, title, channelName, channelId, related } = data;
  if (user) saveHistory(user, "watch", id, title, "yt").catch(console.error);

  const body = `
<div class="watch-layout">
  <div class="watch-player">
    <h2 style="font-size:17px;margin-bottom:10px;text-align:left;">${title}</h2>
    <div class="action-bar">
      <button class="btn btn-yellow" onclick="addFav('${id}',\`${title.replace(/`/g,"\\`")}\`)">⭐ お気に入り</button>
      <a class="btn btn-gray" href="/settings">⚙️ 再生: 通常</a>
      <a class="btn" style="background:#ff0000;color:white;" href="https://www.youtube.com/watch?v=${id}" target="_blank">▶ YouTubeで開く</a>
    </div>
    <div class="channel-info" onclick="goChannel('${channelId}')">📺 ${channelName}</div>
    <video controls preload="auto" playsinline poster="https://i.ytimg.com/vi/${id}/maxresdefault.jpg">
      <source src="${streamUrl}" type="video/mp4">
    </video>
    <div style="margin-top:12px;"><a href="/" style="color:#3498db;">← ホームへ戻る</a></div>
  </div>
  <div class="watch-related">
    <h3>関連動画</h3>
    ${buildRelatedHTML(related)}
  </div>
</div>
`;
  res.send(page(title, "yt", body, "/", FAV_SCRIPT + CHANNEL_NAV_JS));
}

async function handleEmbedWatch(res, id, mode, user) {
  const eduP = mode==="edu" ? await getEduParams().catch(()=>"") : "";
  const videosrc = mode==="edu"
    ? `https://www.youtubeeducation.com/embed/${id}${eduP}`
    : `https://www.youtube-nocookie.com/embed/${id}`;

  let title="動画", channelName="", channelId="", related=[];
  try {
    const d = await getYouTube(id);
    title=d.title; channelName=d.channelName; channelId=d.channelId; related=d.related;
    if(user) saveHistory(user,"watch",id,title,"yt").catch(console.error);
  } catch(e) { /* 埋め込みは継続 */ }

  const modeLabel = mode==="edu" ? "edu (YouTube Education)" : "nocookie (NoCookie)";
  const body = `
<div class="watch-layout">
  <div class="watch-player">
    <h2 style="font-size:17px;margin-bottom:10px;text-align:left;">${title}</h2>
    <div class="action-bar">
      <button class="btn btn-yellow" onclick="addFav('${id}',\`${title.replace(/`/g,"\\`")}\`)">⭐ お気に入り</button>
      <a class="btn btn-gray" href="/settings">⚙️ 再生: ${modeLabel}</a>
      <a class="btn" style="background:#ff0000;color:white;" href="https://www.youtube.com/watch?v=${id}" target="_blank">▶ YouTubeで開く</a>
    </div>
    <div class="channel-info" onclick="goChannel('${channelId}')">📺 ${channelName}</div>
    <div class="iframe-wrap">
      <iframe src="${videosrc}" allowfullscreen allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture"></iframe>
    </div>
    <div style="margin-top:12px;"><a href="/" style="color:#3498db;">← ホームへ戻る</a></div>
  </div>
  <div class="watch-related">
    <h3>関連動画</h3>
    ${buildRelatedHTML(related)}
  </div>
</div>
`;
  res.send(page(title, "yt", body, "/", FAV_SCRIPT + CHANNEL_NAV_JS));
}

// edu / nocookie GET（直接アクセス用）
app.get("/watch/edu/:id", async (req, res) => {
  const { id } = req.params;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) return res.send("動画IDが正しくありません");
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");
  return handleEmbedWatch(res, id, "edu", user);
});
app.get("/watch/nocookie/:id", async (req, res) => {
  const { id } = req.params;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) return res.send("動画IDが正しくありません");
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");
  return handleEmbedWatch(res, id, "nocookie", user);
});

// ======================================
// ■ YouTube 設定
// ======================================
app.get("/settings", (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");
  const currentMode = req.cookies.playbackMode || "normal";
  const modes = [
    { value:"normal",   icon:"🎬", label:"通常",                    desc:"Invidiousを通じてストリームを取得して再生します。" },
    { value:"edu",      icon:"🎓", label:"edu (YouTube Education)", desc:"フィルタリング環境でも視聴できる場合があります。" },
    { value:"nocookie", icon:"🍪", label:"nocookie (NoCookie)",     desc:"プライバシーを重視した埋め込み方式です。" }
  ];
  const cards = modes.map(m=>`
    <div class="mode-card${currentMode===m.value?" selected":""}" onclick="selectMode('${m.value}')">
      <label>
        <input type="radio" name="playbackMode" value="${m.value}"${currentMode===m.value?" checked":""}>
        <div>
          <strong>${m.icon} ${m.label}${currentMode===m.value?'<span class="current-badge">現在</span>':''}</strong>
          <p>${m.desc}</p>
        </div>
      </label>
    </div>
  `).join("");
  const body = `
<div class="settings-box">
  <h2>⚙️ YouTube 再生設定</h2>
  <p style="font-size:14px;color:#666;margin-bottom:20px;">再生方法を選択してください。Cookieに保存されます。</p>
  ${cards}
  <button class="btn btn-green" onclick="saveSettings()" style="margin-top:8px;">💾 保存</button>
  <div id="msg" style="margin-top:12px;color:#27ae60;font-size:14px;display:none;"></div>
</div>
<script>
function selectMode(val){
  document.querySelectorAll('.mode-card').forEach(c=>c.classList.remove('selected'));
  const el=document.querySelector('.mode-card input[value="'+val+'"]');
  if(el){el.checked=true;el.closest('.mode-card').classList.add('selected');}
}
function saveSettings(){
  const sel=document.querySelector('input[name="playbackMode"]:checked');
  if(!sel)return;
  document.cookie="playbackMode="+sel.value+"; path=/; max-age=31536000";
  const msg=document.getElementById("msg");
  msg.style.display="block"; msg.textContent="✅ 保存しました";
  setTimeout(()=>{msg.style.display="none";},3000);
}
</script>
`;
  res.send(page("設定", "yt", body, "/settings"));
});

// ======================================
// ■ チャンネル検索（YouTube専用）
// ======================================
app.get("/channel-search", (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");
  const body = `
<div class="search-wrap">
  <div class="page-header" style="margin-bottom:16px;">
    <h2>チャンネル検索</h2>
    <span class="platform-badge yt">▶ YouTube</span>
  </div>
  <form action="/channel-search/result" method="post">
    <input type="text" name="q" placeholder="チャンネル名を入力...">
    <select name="region" class="form-select">
      <option value="jp">🇯🇵 日本のみ</option>
      <option value="global">🌏 全世界</option>
    </select>
    <button class="btn btn-primary btn-full" type="submit">🔍 検索</button>
  </form>
</div>
`;
  res.send(page("チャンネル検索", "yt", body, "/channel-search"));
});

app.post("/channel-search/result", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");
  const q=req.body.q, region=req.body.region||"jp";
  if(!q) return res.send("検索ワードがありません");

  const url = region==="global"
    ? `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAg%253D%253D`
    : `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAg%253D%253D&hl=ja&gl=JP`;

  let html;
  try { html = await fetch(url,{signal:AbortSignal.timeout(8000)}).then(r=>r.text()); }
  catch(e) { return res.send("タイムアウトしました"); }

  const jsonText = html.match(/var ytInitialData = (.*?);<\/script>/s);
  if(!jsonText) return res.send("データを取得できませんでした");
  let data; try { data=JSON.parse(jsonText[1]); } catch { return res.send("データの解析に失敗しました"); }

  const channels=[];
  function scan(obj){
    if(typeof obj!=="object"||!obj)return;
    if(obj.channelRenderer){const c=obj.channelRenderer;channels.push({id:c.channelId,title:c.title?.simpleText||c.title?.runs?.[0]?.text||"No Title",icon:c.thumbnail?.thumbnails?.[0]?.url||""});}
    for(const k in obj)scan(obj[k]);
  }
  scan(data);

  const cards = channels.slice(0,60).map(c=>`
    <div class="card" onclick="goChannel('${c.id}')" style="cursor:pointer;text-align:center;">
      <img class="thumb" src="${c.icon}" style="border-radius:50%;width:80px;height:80px;object-fit:cover;margin:0 auto 8px;">
      <div style="font-weight:bold;font-size:13px;">${c.title}</div>
    </div>
  `).join("");

  const body = `
<div class="page-header" style="margin-bottom:18px;">
  <h2 style="font-size:18px;">「${q}」のチャンネル</h2>
  <span class="platform-badge yt">▶ YouTube</span>
</div>
<div class="card-grid">${cards}</div>
`;
  res.send(page(`${q} - チャンネル検索`, "yt", body, "/channel-search", CHANNEL_NAV_JS));
});

async function handleChannelVideos(req, res) {
  const user=req.cookies.user; if(!user) return res.redirect("/login");
  const id=req.body?.id||req.query.id; if(!id) return res.send("チャンネルIDがありません");
  let html;
  try { html=await fetch(`https://www.youtube.com/channel/${id}/videos?hl=ja&gl=JP`,{signal:AbortSignal.timeout(8000)}).then(r=>r.text()); }
  catch(e) { return res.send("タイムアウトしました"); }

  const jsonText=html.match(/ytInitialData"\]\s*=\s*(\{.*?\});/)||html.match(/var ytInitialData = (\{.*?\});/);
  if(!jsonText) return res.send("データを取得できませんでした");
  let data; try{data=JSON.parse(jsonText[1]);}catch{return res.send("データの解析に失敗しました");}

  function findGrid(obj){
    if(!obj||typeof obj!=="object")return null;
    if(obj.gridRenderer?.items)return obj.gridRenderer.items;
    if(obj.richGridRenderer?.contents)return obj.richGridRenderer.contents;
    for(const k in obj){const f=findGrid(obj[k]);if(f)return f;}
    return null;
  }
  const grid=findGrid(data)||[];
  const videos=grid.map(v=>v.gridVideoRenderer||v.richItemRenderer?.content?.videoRenderer)
    .filter(v=>v?.videoId)
    .map(v=>({id:v.videoId,title:v.title?.simpleText||v.title?.runs?.map(r=>r.text).join("")||"No Title"}))
    .slice(0,60);

  const chTitle=data.metadata?.channelMetadataRenderer?.title||"チャンネル";
  const cards=videos.map(v=>`
    <form action="/watch" method="post">
      <input type="hidden" name="id" value="${v.id}">
      <button style="all:unset;cursor:pointer;width:100%;">
        <div class="card yt-card">
          <img class="thumb" src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg">
          <div style="margin-top:8px;font-size:13px;font-weight:bold;">${v.title}</div>
        </div>
      </button>
    </form>
  `).join("");

  const body=`
<div class="page-header" style="margin-bottom:18px;">
  <h2 style="font-size:18px;">📺 ${chTitle}</h2>
  <span class="platform-badge yt">▶ YouTube</span>
</div>
<div class="card-grid">${cards}</div>
`;
  res.send(page(chTitle, "yt", body, "/channel-search"));
}
app.get("/channel-videos", handleChannelVideos);
app.post("/channel-videos", handleChannelVideos);

// ======================================
// ■ ニコニコ機能
// ======================================
async function searchNiconico(query, sort="-viewCounter") {
  const url=`https://snapshot.search.nicovideo.jp/api/v2/snapshot/video/contents/search?`
    +`q=${encodeURIComponent(query)}&targets=title,description,tags`
    +`&fields=contentId,title,thumbnailUrl,viewCounter&_limit=60&_sort=${sort}`;
  const res=await fetch(url,{headers:{"User-Agent":"NicoViewer/1.0"},signal:AbortSignal.timeout(8000)});
  if(!res.ok) throw new Error("Niconico API error: "+res.status);
  return (await res.json()).data||[];
}

async function getNicoRanking(genre="all", term="24h") {
  const xml=await fetch(
    `https://www.nicovideo.jp/ranking/genre/${genre}?term=${term}&rss=2.0&lang=ja-jp`,
    {headers:{"User-Agent":"NicoViewer/1.0"},signal:AbortSignal.timeout(8000)}
  ).then(r=>r.text());
  const items=[];
  for(const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)){
    const b=m[1];
    const tM=b.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
    const lM=b.match(/<link>(.*?)<\/link>/);
    if(!tM||!lM) continue;
    const title=tM[1].replace(/^\d+位：/,"").trim();
    const idM=lM[1].trim().match(/\/watch\/(sm\d+|nm\d+|so\d+)/);
    if(!idM) continue;
    const id=idM[1], numId=id.replace(/^[a-zA-Z]+/,"");
    items.push({id,title,thumb:`https://nicovideo.cdn.nimg.jp/thumbnails/${numId}/${numId}`});
    if(items.length>=60) break;
  }
  return items;
}

async function getNicoTitle(id) {
  try {
    const xml=await fetch(`https://ext.nicovideo.jp/api/getthumbinfo/${id}`,{signal:AbortSignal.timeout(5000)}).then(r=>r.text());
    const m=xml.match(/<title>(.*?)<\/title>/); return m?m[1]:id;
  } catch { return id; }
}

app.post("/nico/search", async (req, res) => {
  const user=req.cookies.user; if(!user) return res.redirect("/login");
  const q=req.body.q, sort=req.body.sort||"-viewCounter";
  if(!q) return res.send("検索ワードがありません");

  let videos=[], error=null;
  try { videos=await searchNiconico(q,sort); } catch(e) { error=e.message; }

  const sortLabel={"-viewCounter":"再生数順","-commentCounter":"コメント数順","-mylistCounter":"マイリスト順","-startTime":"投稿日時順"}[sort]||sort;
  const cards=videos.map(v=>{
    const numId=v.contentId.replace(/^[a-zA-Z]+/,"");
    const thumb=v.thumbnailUrl||`https://nicovideo.cdn.nimg.jp/thumbnails/${numId}/${numId}`;
    const views=v.viewCounter!=null?`👁 ${Number(v.viewCounter).toLocaleString()}`:"";
    return `
      <form action="/nico/watch" method="post">
        <input type="hidden" name="id" value="${v.contentId}">
        <button style="all:unset;cursor:pointer;width:100%;">
          <div class="card nico-card">
            <img class="thumb" src="${thumb}">
            <div style="margin-top:8px;font-size:13px;font-weight:bold;line-height:1.4;">${v.title}</div>
            <div style="font-size:12px;color:#999;margin-top:4px;">${views}</div>
          </div>
        </button>
      </form>
    `;
  }).join("");

  const body=`
<div class="page-header" style="margin-bottom:18px;">
  <h2 style="font-size:18px;">「${q}」の検索結果</h2>
  <span class="platform-badge nico">🎬 ニコニコ</span>
  <span style="font-size:13px;color:#999;margin-left:auto;">${sortLabel} / ${videos.length}件</span>
</div>
${error?`<div style="text-align:center;padding:30px;color:#e74c3c;">⚠️ ${error}</div>`:""}
${!error&&videos.length===0?`<div style="text-align:center;padding:30px;color:#999;">動画が見つかりませんでした</div>`:""}
<div class="card-grid">${cards}</div>
`;
  res.send(page(`${q} - ニコニコ検索`, "nico", body, "/nico"));
});

app.get("/nico/ranking", async (req, res) => {
  const user=req.cookies.user; if(!user) return res.redirect("/login");
  const genre=req.query.genre||"all", term=req.query.term||"24h";

  const genreOptions=[
    {v:"all",l:"🌐 総合"},{v:"game",l:"🎮 ゲーム"},{v:"anime",l:"📺 アニメ"},
    {v:"music",l:"🎵 音楽"},{v:"sing",l:"🎤 歌ってみた"},{v:"play",l:"🎸 演奏してみた"},
    {v:"dance",l:"💃 踊ってみた"},{v:"vocaloid",l:"🎹 VOCALOID"},
    {v:"tech",l:"🔧 技術・工作"},{v:"science",l:"🔬 解説・講座"},
    {v:"sport",l:"⚽ スポーツ"},{v:"niconico-indies",l:"🎭 インディーズ"},
  ];
  const termOptions=[{v:"24h",l:"24時間"},{v:"week",l:"週間"},{v:"month",l:"月間"},{v:"total",l:"合計"}];

  let videos=[], error=null;
  try { videos=await getNicoRanking(genre,term); } catch(e) { error=e.message; }

  const genreSelect=genreOptions.map(o=>`<option value="${o.v}"${genre===o.v?" selected":""}>${o.l}</option>`).join("");
  const termSelect=termOptions.map(o=>`<option value="${o.v}"${term===o.v?" selected":""}>${o.l}</option>`).join("");

  const cards=videos.map((v,i)=>`
    <form action="/nico/watch" method="post">
      <input type="hidden" name="id" value="${v.id}">
      <button style="all:unset;cursor:pointer;width:100%;">
        <div class="card nico-card" style="position:relative;">
          <span class="rank-badge">${i+1}位</span>
          <img class="thumb" src="${v.thumb}">
          <div style="margin-top:8px;font-size:13px;font-weight:bold;line-height:1.4;">${v.title}</div>
        </div>
      </button>
    </form>
  `).join("");

  const body=`
<div class="page-header" style="margin-bottom:18px;">
  <h2>🏆 ランキング</h2>
  <span class="platform-badge nico">🎬 ニコニコ</span>
</div>
<form action="/nico/ranking" method="get"
      style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;max-width:700px;">
  <select name="genre" class="form-select" style="flex:1;min-width:150px;">${genreSelect}</select>
  <select name="term"  class="form-select" style="flex:1;min-width:120px;">${termSelect}</select>
  <button class="btn btn-primary" type="submit" style="margin-bottom:12px;">🔄 更新</button>
</form>
${error?`<div style="text-align:center;padding:30px;color:#e74c3c;">⚠️ ${error}</div>`:""}
<div class="card-grid">${cards}</div>
`;
  res.send(page("ニコニコランキング", "nico", body, "/nico/ranking"));
});

app.post("/nico/watch", async (req, res) => {
  const user=req.cookies.user; if(!user) return res.redirect("/login");
  const id=req.body.id;
  if(!id) return res.send("動画IDがありません");
  if(!/^(sm|nm|so|ax)\d+$/.test(id)) return res.send("動画IDが正しくありません");

  const title=await getNicoTitle(id);
  saveHistory(user,"watch",id,title,"nico").catch(console.error);

  const embedUrl=`https://embed.nicovideo.jp/watch/${id}?autoplay=1&oldScript=1&referer=&from=0&allowProgrammaticFullScreen=1`;
  const body=`
<div class="watch-layout">
  <div class="watch-player">
    <h2 style="font-size:17px;margin-bottom:10px;text-align:left;">
      <span class="platform-badge nico" style="margin-right:6px;vertical-align:middle;">ニコニコ</span>${title}
    </h2>
    <div class="action-bar">
      <button class="btn btn-yellow" onclick="addNicoFav('${id}',\`${title.replace(/`/g,"\\`")}\`)">⭐ お気に入り</button>
      <a class="btn" style="background:#e6242b;color:white;" href="https://www.nicovideo.jp/watch/${id}" target="_blank">🎬 ニコニコで開く</a>
    </div>
    <div class="iframe-wrap">
      <iframe src="${embedUrl}" allowfullscreen allow="autoplay;fullscreen;encrypted-media" referrerpolicy="no-referrer"></iframe>
    </div>
    <div style="margin-top:12px;">
      <a href="/nico" style="color:#e6242b;">← ホームへ戻る</a>
      &nbsp;|&nbsp;
      <a href="/nico/ranking" style="color:#e6242b;">🏆 ランキング</a>
    </div>
  </div>
</div>
<script>
function addNicoFav(id,title){
  fetch("/nico/favorite/add",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({videoId:id,title:title})})
  .then(r=>r.json()).then(d=>{
    if(d.ok)alert("お気に入りに追加しました");
    else if(d.duplicate)alert("すでに登録済みです");
    else alert("エラーが発生しました");
  }).catch(()=>alert("通信エラー"));
}
</script>
`;
  res.send(page(title, "nico", body, "/nico"));
});

app.post("/nico/favorite/add", async (req, res) => {
  const user=req.cookies.user; if(!user) return res.status(401).json({ok:false,error:"unauthorized"});
  const {videoId,title}=req.body; if(!videoId||!title) return res.status(400).json({ok:false,error:"missing params"});
  const storedId=`nico:${videoId}`;
  try {
    const ex=await pool.query("SELECT 1 FROM favorites WHERE user_id=$1 AND video_id=$2",[user,storedId]);
    if(ex.rows.length>0) return res.json({ok:false,duplicate:true});
    await pool.query("INSERT INTO favorites (user_id,video_id,title) VALUES ($1,$2,$3)",[user,storedId,title]);
    res.json({ok:true});
  } catch(e) { res.json({ok:false,error:e.message}); }
});

// ======================================
// ■ お気に入り（プラットフォーム別表示）
// ======================================
app.get("/favorites", async (req, res) => {
  const user=req.cookies.user; if(!user) return res.redirect("/login");
  const platform=getPlatform(req);

  const result=await pool.query("SELECT * FROM favorites WHERE user_id=$1 ORDER BY created_at DESC",[user]);
  const filtered=result.rows.filter(v=>{
    const isNico=v.video_id.startsWith("nico:");
    return platform==="nico" ? isNico : !isNico;
  });

  const cards=filtered.map(v=>{
    const isNico=v.video_id.startsWith("nico:");
    const cleanId=isNico?v.video_id.replace("nico:",""):v.video_id;
    const thumb=getThumbUrl(v.video_id,"hq");
    const action=isNico?"/nico/watch":"/watch";
    return `
      <form action="${action}" method="post">
        <input type="hidden" name="id" value="${cleanId}">
        <button style="all:unset;cursor:pointer;width:100%;">
          <div class="card ${isNico?"nico-card":"yt-card"}">
            <img class="thumb" src="${thumb}">
            <div style="margin-top:8px;font-size:13px;font-weight:bold;">${v.title}</div>
          </div>
        </button>
      </form>
    `;
  }).join("");

  const body=`
<div class="page-header" style="margin-bottom:18px;">
  <h2>⭐ お気に入り</h2>
  <span class="platform-badge ${platform}">${platform==="nico"?"🎬 ニコニコ":"▶ YouTube"}</span>
  <span style="font-size:13px;color:#999;margin-left:auto;">${filtered.length}件</span>
</div>
${filtered.length===0
  ?`<div style="text-align:center;padding:60px;color:#999;">
      まだお気に入りがありません<br>
      <a href="${platform==="nico"?"/nico":"/"}" style="color:var(--accent);margin-top:12px;display:inline-block;">動画を探す →</a>
    </div>`
  :`<div class="card-grid">${cards}</div>`}
`;
  res.send(page("お気に入り", platform, body, "/favorites"));
});

app.post("/favorite/add", async (req, res) => {
  const user=req.cookies.user; if(!user) return res.status(401).json({ok:false,error:"unauthorized"});
  const {videoId,title}=req.body; if(!videoId||!title) return res.status(400).json({ok:false,error:"missing params"});
  try {
    const ex=await pool.query("SELECT 1 FROM favorites WHERE user_id=$1 AND video_id=$2",[user,videoId]);
    if(ex.rows.length>0) return res.json({ok:false,duplicate:true});
    await pool.query("INSERT INTO favorites (user_id,video_id,title) VALUES ($1,$2,$3)",[user,videoId,title]);
    res.json({ok:true});
  } catch(e) { res.json({ok:false,error:e.message}); }
});

// ======================================
// ■ 履歴（プラットフォーム別表示・削除）
// ======================================
app.get("/history", async (req, res) => {
  const user=req.cookies.user; if(!user) return res.redirect("/login");
  const platform=getPlatform(req);

  const result=await pool.query(
    "SELECT query,video_id,title,created_at FROM history WHERE user_id=$1 ORDER BY created_at DESC",[user]
  );
  const filtered=result.rows.filter(v=>{
    const isNico=v.video_id.startsWith("nico:");
    return platform==="nico" ? isNico : !isNico;
  });

  const cards=filtered.map(item=>{
    const isNico=item.video_id.startsWith("nico:");
    const cleanId=isNico?item.video_id.replace("nico:",""):item.video_id;
    const thumb=getThumbUrl(item.video_id);
    const clickFn=isNico?`postNicoWatch('${cleanId}')`:`postWatch('${cleanId}')`;
    return `
      <div class="history-card">
        <img src="${thumb}" onerror="this.style.background='#eee'">
        <div style="flex:1;min-width:0;">
          <div style="font-size:11px;color:#aaa;margin-bottom:4px;">${formatDateJP(item.created_at)}</div>
          <a href="#" onclick="${clickFn};return false;"
             style="font-weight:bold;color:#2c3e50;text-decoration:none;font-size:14px;
                    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
            ${item.title}
          </a>
        </div>
      </div>
    `;
  }).join("");

  const body=`
<div class="page-header" style="margin-bottom:18px;">
  <h2>🕘 視聴履歴</h2>
  <span class="platform-badge ${platform}">${platform==="nico"?"🎬 ニコニコ":"▶ YouTube"}</span>
  <span style="font-size:13px;color:#999;margin-left:auto;">${filtered.length}件</span>
</div>
<form action="/history/delete" method="POST" style="margin-bottom:16px;">
  <input type="hidden" name="platform" value="${platform}">
  <button class="btn btn-danger">🗑 この履歴をすべて削除</button>
</form>
${filtered.length===0
  ?`<div style="text-align:center;padding:60px;color:#999;">履歴がありません</div>`
  :cards}
${WATCH_NAV_JS}
`;
  res.send(page("視聴履歴", platform, body, "/history"));
});

app.post("/history/delete", async (req, res) => {
  const user=req.cookies.user; if(!user) return res.redirect("/login");
  const platform=req.body.platform||getPlatform(req);
  if(platform==="nico"){
    await pool.query("DELETE FROM history WHERE user_id=$1 AND video_id LIKE 'nico:%'",[user]);
  } else {
    await pool.query("DELETE FROM history WHERE user_id=$1 AND video_id NOT LIKE 'nico:%'",[user]);
  }
  res.redirect("/history");
});

// ======================================
// ■ 管理者ページ
// ======================================
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme";

app.get("/admin", (req, res) => {
  const user=req.cookies.user, pass=req.query.pass;
  if(!user) return res.redirect("/login");
  if(user!==ADMIN_USER) return res.send("アクセス権がありません");
  if(pass!==ADMIN_PASSWORD){
    const body=`
<div class="center-box">
  <h2>🛡️ 管理者ログイン</h2>
  <form>
    <input type="password" name="pass" placeholder="管理者パスワード" required>
    <button class="btn btn-primary btn-full">ログイン</button>
  </form>
</div>
`;
    return res.send(page("管理者ログイン", getPlatform(req), body));
  }
  res.send(`<form id="f" method="POST" action="/admin"><input type="hidden" name="pass" value="${ADMIN_PASSWORD}"></form><script>document.getElementById("f").submit();</script>`);
});

app.post("/admin", async (req, res) => {
  const pass=req.body.pass; if(pass!==ADMIN_PASSWORD) return res.send("パスワードが違います");
  const result=await pool.query("SELECT user_id,query,video_id,title,created_at FROM admin_history ORDER BY created_at DESC");
  const byUser={};
  for(const row of result.rows){
    if(!byUser[row.user_id]) byUser[row.user_id]=[];
    byUser[row.user_id].push(row);
  }

  // ユーザー一覧
  let usersHTML = "";
  try {
    const usersResult = await pool.query("SELECT id, username, reg_ip, created_at FROM users ORDER BY created_at DESC");
    if (usersResult.rows.length === 0) {
      usersHTML = `<p style="color:#999;text-align:center;padding:30px;">登録ユーザーはいません</p>`;
    } else {
      usersHTML = `
<table style="width:100%;border-collapse:collapse;font-size:14px;">
  <thead>
    <tr style="background:#f5f5f5;border-bottom:2px solid #ddd;">
      <th style="text-align:left;padding:10px 12px;">ユーザー名</th>
      <th style="text-align:left;padding:10px 12px;">登録日時</th>
      <th style="text-align:left;padding:10px 12px;">登録IP</th>
      <th style="text-align:center;padding:10px 12px;">操作</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom:1px solid #eee;">
      <td style="padding:10px 12px;font-weight:bold;">👑 ${ADMIN_USER} <span style="font-size:11px;background:#e74c3c;color:white;padding:1px 7px;border-radius:10px;margin-left:6px;">管理者</span></td>
      <td style="padding:10px 12px;color:#888;">環境変数</td>
      <td style="padding:10px 12px;color:#888;">—</td>
      <td style="padding:10px 12px;text-align:center;">—</td>
    </tr>
    ${usersResult.rows.map(u => `
    <tr style="border-bottom:1px solid #eee;">
      <td style="padding:10px 12px;">👤 ${u.username}</td>
      <td style="padding:10px 12px;color:#888;">${formatDateJP(u.created_at)}</td>
      <td style="padding:10px 12px;color:#888;font-size:12px;font-family:monospace;">${u.reg_ip || "—"}</td>
      <td style="padding:10px 12px;text-align:center;">
        <form method="POST" action="/admin/delete-account" style="display:inline;">
          <input type="hidden" name="pass" value="${ADMIN_PASSWORD}">
          <input type="hidden" name="username" value="${u.username}">
          <button class="btn btn-danger" style="font-size:12px;padding:5px 12px;margin:0;"
            onclick="return confirm('${u.username} のアカウントを削除しますか？')">
            🗑 削除
          </button>
        </form>
      </td>
    </tr>`).join("")}
  </tbody>
</table>`;
    }
  } catch(e) {
    usersHTML = `<p style="color:#e74c3c;">ユーザー一覧の取得に失敗しました: ${e.message}</p>`;
  }

  let allHTML="", delHTML="";
  for(const userName in byUser){
    allHTML+=`<h3 style="margin-top:24px;padding-bottom:6px;border-bottom:1px solid #eee;">${userName}</h3>`;
    allHTML+=byUser[userName].map(item=>{
      const isNico=item.video_id.startsWith("nico:");
      const cleanId=isNico?item.video_id.replace("nico:",""):item.video_id;
      const thumb=getThumbUrl(item.video_id);
      const clickFn=isNico?`postNicoWatch('${cleanId}')`:`postWatch('${cleanId}')`;
      const badge=isNico?`<span class="badge-nico">ニコ</span>`:`<span class="badge-yt">YT</span>`;
      return `
        <div class="history-card">
          <img src="${thumb}" style="background:#eee;">
          <div>
            <div style="font-size:11px;color:#aaa;">${formatDateJP(item.created_at)} ${badge}</div>
            <a href="#" onclick="${clickFn};return false;" style="font-weight:bold;color:#2c3e50;text-decoration:none;font-size:13px;">${item.title}</a>
          </div>
        </div>`;
    }).join("");
    delHTML+=`
      <form method="POST" action="/admin/delete-user" style="margin-bottom:8px;">
        <input type="hidden" name="user" value="${userName}">
        <input type="hidden" name="pass" value="${ADMIN_PASSWORD}">
        <button class="btn btn-danger">${userName} の履歴を削除</button>
      </form>`;
  }
  const body=`
<h2>🛡️ 管理者ページ</h2>
<p style="text-align:center;color:#e74c3c;font-size:13px;">※ユーザーが削除してもこの記録は残ります</p>
<div class="tabs">
  <button class="tab active" id="tab-all" onclick="openTab('all')">全履歴</button>
  <button class="tab" id="tab-del" onclick="openTab('del')">記録削除</button>
  <button class="tab" id="tab-users" onclick="openTab('users')">👥 ユーザー一覧</button>
</div>
<div class="tab-content active" id="content-all">${allHTML}</div>
<div class="tab-content" id="content-del">${delHTML}</div>
<div class="tab-content" id="content-users">${usersHTML}</div>
<script>
function openTab(n){document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));document.querySelectorAll(".tab-content").forEach(c=>c.classList.remove("active"));document.getElementById("tab-"+n).classList.add("active");document.getElementById("content-"+n).classList.add("active");}
function postWatch(id){const f=document.createElement("form");f.method="POST";f.action="/watch";const i=document.createElement("input");i.type="hidden";i.name="id";i.value=id;f.appendChild(i);document.body.appendChild(f);f.submit();}
function postNicoWatch(id){const f=document.createElement("form");f.method="POST";f.action="/nico/watch";const i=document.createElement("input");i.type="hidden";i.name="id";i.value=id;f.appendChild(i);document.body.appendChild(f);f.submit();}
</script>
`;
  res.send(page("管理者ページ", getPlatform(req), body));
});

app.post("/admin/delete-user", async (req, res) => {
  const {pass,user}=req.body; if(pass!==ADMIN_PASSWORD) return res.send("パスワードが違います");
  await pool.query("DELETE FROM admin_history WHERE user_id=$1",[user]);
  res.redirect(`/admin?pass=${ADMIN_PASSWORD}`);
});

app.post("/admin/delete-account", async (req, res) => {
  const {pass, username}=req.body; if(pass!==ADMIN_PASSWORD) return res.send("パスワードが違います");
  if(username===ADMIN_USER) return res.send("管理者アカウントは削除できません");
  await pool.query("DELETE FROM users WHERE username=$1",[username]);
  res.redirect(`/admin?pass=${ADMIN_PASSWORD}`);
});

// ======================================
// ■ その他
// ======================================
app.get("/music",  (req, res) => res.redirect("https://musicviewer.onrender.com/"));
app.get("/health", (req, res) => res.status(200).send("OK"));

app.listen(PORT, () => console.log("Server running on port " + PORT));

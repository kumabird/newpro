import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import cookieParser from "cookie-parser";

const app = express();
app.disable("x-powered-by");

const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.json());

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

  .sidebar a.nico-link:hover {
    background: #fff3e6;
  }

  .sidebar-icon {
    font-size: 20px;
  }

  .sidebar-divider {
    border: none;
    border-top: 1px solid #eee;
    margin: 6px 10px;
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

  .card.nico-card {
    border-left: 3px solid #e6242b;
  }

  .thumb {
    width: 100%;
    border-radius: 10px;
    aspect-ratio: 16/9;
    object-fit: cover;
    background: #eee;
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
    box-sizing: border-box;
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

  .nico-btn {
    background: #e6242b !important;
  }

  .nico-btn:hover {
    background: #c41e24 !important;
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
    box-sizing: border-box;
  }

  .region-select:hover {
    border-color: #3498db;
  }

  /* プラットフォームタブ */
  .platform-tabs {
    display: flex;
    gap: 8px;
    max-width: 800px;
    margin: 0 auto 16px;
  }

  .platform-tab {
    flex: 1;
    padding: 10px 16px;
    border-radius: 10px;
    cursor: pointer;
    font-weight: bold;
    font-size: 15px;
    text-align: center;
    border: 2px solid #ddd;
    background: white;
    transition: all 0.2s;
  }

  .platform-tab.yt.active {
    background: #ff0000;
    color: white;
    border-color: #ff0000;
  }

  .platform-tab.nico.active {
    background: #e6242b;
    color: white;
    border-color: #e6242b;
  }

  .platform-tab:hover {
    border-color: #999;
  }

  .platform-section {
    display: none;
  }

  .platform-section.active {
    display: block;
  }

  /* ニコニコバッジ */
  .nico-badge {
    display: inline-block;
    background: #e6242b;
    color: white;
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 4px;
    margin-left: 6px;
    vertical-align: middle;
    font-weight: bold;
  }

  .yt-badge {
    display: inline-block;
    background: #ff0000;
    color: white;
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 4px;
    margin-left: 6px;
    vertical-align: middle;
    font-weight: bold;
  }

  /* 設定ページ */
  .settings-box {
    max-width: 560px;
    margin: 40px auto;
    background: white;
    padding: 32px;
    border-radius: 14px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  }
  .settings-box h3 {
    font-size: 15px;
    color: #666;
    margin-bottom: 18px;
  }
  .mode-card {
    border: 2px solid #ddd;
    border-radius: 10px;
    padding: 14px 18px;
    margin-bottom: 14px;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
  }
  .mode-card:hover {
    border-color: #3498db;
    background: #f0f8ff;
  }
  .mode-card.selected {
    border-color: #3498db;
    background: #e8f4ff;
  }
  .mode-card label {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    cursor: pointer;
  }
  .mode-card input[type=radio] {
    width: auto;
    margin: 3px 0 0;
    flex-shrink: 0;
  }
  .mode-card strong {
    display: block;
    font-size: 16px;
    margin-bottom: 4px;
    color: #2c3e50;
  }
  .mode-card p {
    margin: 0;
    font-size: 13px;
    color: #666;
    line-height: 1.5;
  }
  .current-mode-badge {
    display: inline-block;
    background: #3498db;
    color: white;
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 20px;
    margin-left: 8px;
    vertical-align: middle;
  }
</style>
`;

// --------------------------------------
// サイドバー HTML（ニコニコリンク追加）
// --------------------------------------
const SIDEBAR_HTML = `
<div id="sidebar" class="sidebar">
  <a href="/"><span class="sidebar-icon">🏠</span> <span class="sidebar-text">ホーム</span></a>
  <a href="/channel-search"><span class="sidebar-icon">📺</span> <span class="sidebar-text">チャンネル検索</span></a>
  <a href="/music"><span class="sidebar-icon">♫</span> <span class="sidebar-text">Music</span></a>
  <hr class="sidebar-divider">
  <a href="/nico" class="nico-link"><span class="sidebar-icon">🎬</span> <span class="sidebar-text">ニコニコ</span></a>
  <a href="/nico/ranking" class="nico-link"><span class="sidebar-icon">🏆</span> <span class="sidebar-text">ニコ動ランキング</span></a>
  <hr class="sidebar-divider">
  <a href="/favorites"><span class="sidebar-icon">⭐</span> <span class="sidebar-text">お気に入り</span></a>
  <a href="/history"><span class="sidebar-icon">🕘</span> <span class="sidebar-text">履歴</span></a>
  <a href="/settings"><span class="sidebar-icon">⚙️</span> <span class="sidebar-text">設定</span></a>
  <a href="/admin"><span class="sidebar-icon">🛡️</span> <span class="sidebar-text">管理者ページ</span></a>
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
// チャンネルへ POST 遷移するヘルパー JS
// --------------------------------------
const CHANNEL_NAV_JS = `
<script>
function goChannel(id) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/channel-videos";
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "id";
  input.value = id;
  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
}
</script>
`;

// --------------------------------------
// ユーザー管理
// --------------------------------------
function loadUsers() {
  if (!fs.existsSync("users.json")) return [];
  return JSON.parse(fs.readFileSync("users.json", "utf8"));
}

// source: "yt" | "nico"
async function saveHistory(user, keyword, videoId, title, source = "yt") {
  // ニコニコは video_id に "nico:" プレフィックスを付けて保存
  const storedId = source === "nico" ? `nico:${videoId}` : videoId;
  const params = [user, keyword, storedId, title];
  await Promise.allSettled([
    pool.query(
      "INSERT INTO history (user_id, query, video_id, title) VALUES ($1, $2, $3, $4)",
      params
    ),
    pool.query(
      "INSERT INTO admin_history (user_id, query, video_id, title) VALUES ($1, $2, $3, $4)",
      params
    )
  ]);
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
// サムネイル URL 取得（YouTube / ニコニコ 両対応）
// --------------------------------------
function getThumbUrl(videoId, size = "mq") {
  if (videoId.startsWith("nico:")) {
    const nicoId = videoId.replace("nico:", "");
    const numId = nicoId.replace(/^[a-zA-Z]+/, "");
    return `https://nicovideo.cdn.nimg.jp/thumbnails/${numId}/${numId}`;
  }
  const sizeMap = { hq: "hqdefault", mq: "mqdefault", max: "maxresdefault" };
  return `https://i.ytimg.com/vi/${videoId}/${sizeMap[size] || "mqdefault"}.jpg`;
}

// 履歴・お気に入りの視聴リンク生成（YouTube / ニコニコ 両対応）
function buildHistoryCard(item) {
  const isNico = item.video_id.startsWith("nico:");
  const cleanId = isNico ? item.video_id.replace("nico:", "") : item.video_id;
  const thumb = getThumbUrl(item.video_id);
  const badge = isNico
    ? `<span class="nico-badge">ニコニコ</span>`
    : `<span class="yt-badge">YouTube</span>`;

  const clickHandler = isNico
    ? `postNicoWatch('${cleanId}')`
    : `postWatch('${cleanId}')`;

  return `
    <div class="card" style="margin-bottom:12px;display:flex;gap:12px;align-items:center;">
      <img src="${thumb}"
           style="width:120px;height:68px;border-radius:8px;object-fit:cover;flex-shrink:0;background:#eee;"
           onerror="this.src='/static/no-thumb.png'">
      <div>
        <div style="font-size:12px;color:#999;">${formatDateJP(item.created_at)} ${badge}</div>
        <a href="#" onclick="${clickHandler}" style="font-weight:bold;color:#2c3e50;text-decoration:none;">
          ${item.title}
        </a>
      </div>
    </div>
  `;
}

function buildFavCard(v) {
  const isNico = v.video_id.startsWith("nico:");
  const cleanId = isNico ? v.video_id.replace("nico:", "") : v.video_id;
  const thumb = getThumbUrl(v.video_id, "hq");
  const action = isNico ? "/nico/watch" : "/watch";
  const badge = isNico
    ? `<span class="nico-badge">ニコニコ</span>`
    : `<span class="yt-badge">YouTube</span>`;

  return `
    <div class="card${isNico ? " nico-card" : ""}">
      <form action="${action}" method="post">
        <input type="hidden" name="id" value="${cleanId}">
        <button style="all:unset;cursor:pointer;width:100%;">
          <img class="thumb" src="${thumb}"
               onerror="this.src='https://nicovideo.cdn.nimg.jp/thumbnails/${cleanId.replace(/^[a-zA-Z]+/,"")}/${cleanId.replace(/^[a-zA-Z]+/,"")}'">
          <div style="margin-top:8px;font-weight:bold;">${v.title} ${badge}</div>
        </button>
      </form>
    </div>
  `;
}

const WATCH_NAV_JS = `
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
function postNicoWatch(id) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/nico/watch";
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "id";
  input.value = id;
  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
}
</script>
`;

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
// ホーム（YouTube / ニコニコ タブ選択）
// --------------------------------------
app.get("/", (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  res.send(`
    <html>
    <head>
      ${CSS}
    </head>
    <body>
      ${SIDEBAR_HTML}
      <div id="main-content" class="main-content">
        <h2>動画検索</h2>

        <div class="platform-tabs">
          <div class="platform-tab yt active" id="tab-yt" onclick="switchTab('yt')">
            ▶ YouTube
          </div>
          <div class="platform-tab nico" id="tab-nico" onclick="switchTab('nico')">
            🎬 ニコニコ動画
          </div>
        </div>

        <!-- YouTube 検索フォーム -->
        <div class="platform-section active" id="sec-yt" style="max-width:800px;margin:0 auto;">
          <form action="/search" method="post">
            <input type="text" name="q" placeholder="YouTubeで検索">
            <select name="region" class="region-select">
              <option value="jp">日本のみ</option>
              <option value="global">全世界</option>
            </select>
            <button type="submit">動画を検索</button>
          </form>
        </div>

        <!-- ニコニコ 検索フォーム -->
        <div class="platform-section" id="sec-nico" style="max-width:800px;margin:0 auto;">
          <form action="/nico/search" method="post">
            <input type="text" name="q" placeholder="ニコニコ動画で検索">
            <select name="sort" class="region-select">
              <option value="-viewCounter">再生数順</option>
              <option value="-commentCounter">コメント数順</option>
              <option value="-mylistCounter">マイリスト順</option>
              <option value="-startTime">投稿日時順（新しい）</option>
            </select>
            <button type="submit" class="nico-btn">🎬 ニコニコで検索</button>
          </form>
          <div style="text-align:center;margin-top:10px;">
            <a href="/nico/ranking" style="color:#e6242b;font-size:14px;">🏆 ニコニコランキングを見る</a>
          </div>
        </div>
      </div>
      ${SIDEBAR_JS}
      <script>
        function switchTab(tab) {
          document.getElementById("tab-yt").classList.remove("active");
          document.getElementById("tab-nico").classList.remove("active");
          document.getElementById("sec-yt").classList.remove("active");
          document.getElementById("sec-nico").classList.remove("active");
          document.getElementById("tab-" + tab).classList.add("active");
          document.getElementById("sec-" + tab).classList.add("active");
          localStorage.setItem("homeTab", tab);
        }
        // タブ状態を復元
        const saved = localStorage.getItem("homeTab");
        if (saved === "nico") switchTab("nico");
      </script>
    </body>
    </html>
  `);
});

// ======================================
// ■ ニコニコ動画 機能
// ======================================

// ニコニコ動画検索（Snapshot Search API v2）
async function searchNiconico(query, sort = "-viewCounter") {
  const url = `https://snapshot.search.nicovideo.jp/api/v2/snapshot/video/contents/search?` +
    `q=${encodeURIComponent(query)}&targets=title,description,tags` +
    `&fields=contentId,title,thumbnailUrl,viewCounter,commentCounter,lengthSeconds` +
    `&_limit=60&_sort=${sort}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "NicoViewer/1.0 (private use)" },
    signal: AbortSignal.timeout(8000)
  });

  if (!res.ok) throw new Error("Niconico API error: " + res.status);
  const data = await res.json();
  return data.data || [];
}

// ニコニコランキング取得（RSSスクレイピング）
async function getNicoRanking(genre = "all", term = "24h") {
  // genre: all, game, anime, music, science, etc.
  // term: 24h, week, month, total
  const url = `https://www.nicovideo.jp/ranking/genre/${genre}?term=${term}&rss=2.0&lang=ja-jp`;
  const res = await fetch(url, {
    headers: { "User-Agent": "NicoViewer/1.0" },
    signal: AbortSignal.timeout(8000)
  });
  const xml = await res.text();

  const items = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  for (const m of itemMatches) {
    const block = m[1];
    const titleMatch = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
    const linkMatch  = block.match(/<link>(.*?)<\/link>/);
    if (!titleMatch || !linkMatch) continue;
    const title = titleMatch[1].replace(/^\d+位：/, "").trim();
    const link  = linkMatch[1].trim();
    const idMatch = link.match(/\/watch\/(sm\d+|nm\d+|so\d+)/);
    if (!idMatch) continue;
    const id = idMatch[1];
    const numId = id.replace(/^[a-zA-Z]+/, "");
    items.push({ id, title, thumb: `https://nicovideo.cdn.nimg.jp/thumbnails/${numId}/${numId}` });
    if (items.length >= 60) break;
  }
  return items;
}

// ニコニコ動画タイトル取得（履歴保存用）
async function getNicoVideoTitle(id) {
  try {
    const url = `https://ext.nicovideo.jp/api/getthumbinfo/${id}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const xml = await res.text();
    const m = xml.match(/<title>(.*?)<\/title>/);
    return m ? m[1] : id;
  } catch (e) {
    return id;
  }
}

// ニコニコ動画検索ページ（GET）
app.get("/nico", (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");
  res.redirect("/?tab=nico");
});

// ニコニコ動画検索結果（POST）
app.post("/nico/search", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  const q    = req.body.q;
  const sort = req.body.sort || "-viewCounter";
  if (!q) return res.send("検索ワードがありません");

  let videos = [];
  let error  = null;

  try {
    videos = await searchNiconico(q, sort);
  } catch (e) {
    error = e.message;
  }

  const sortLabel = {
    "-viewCounter":    "再生数順",
    "-commentCounter": "コメント数順",
    "-mylistCounter":  "マイリスト順",
    "-startTime":      "投稿日時順"
  }[sort] || sort;

  const cards = videos.map(v => {
    const numId = v.contentId.replace(/^[a-zA-Z]+/, "");
    const thumb = v.thumbnailUrl || `https://nicovideo.cdn.nimg.jp/thumbnails/${numId}/${numId}`;
    const views = v.viewCounter != null ? `👁 ${Number(v.viewCounter).toLocaleString()}` : "";
    return `
      <form action="/nico/watch" method="post" style="display:inline;">
        <input type="hidden" name="id" value="${v.contentId}">
        <button style="all:unset;cursor:pointer;width:100%;">
          <div class="card nico-card">
            <img class="thumb" src="${thumb}" onerror="this.style.background='#eee'">
            <div style="margin-top:8px;font-weight:bold;font-size:14px;">${v.title}</div>
            <div style="font-size:12px;color:#999;margin-top:4px;">${views}</div>
          </div>
        </button>
      </form>
    `;
  }).join("");

  const errorHTML = error
    ? `<div style="text-align:center;color:#e74c3c;padding:20px;">
        ⚠️ 検索に失敗しました: ${error}<br>
        <small>ニコニコのAPIが利用できない可能性があります。しばらく時間をおいて再度お試しください。</small>
       </div>`
    : (videos.length === 0 ? `<div style="text-align:center;color:#999;padding:40px;">動画が見つかりませんでした</div>` : "");

  res.send(`
    <html>
    <head>${CSS}</head>
    <body>
      ${SIDEBAR_HTML}
      <div id="main-content" class="main-content">
        <h2 style="color:#e6242b;">🎬 ニコニコ検索結果: ${q}（${sortLabel}）</h2>
        <div style="text-align:center;margin-bottom:16px;">
          <a href="/" style="color:#e6242b;font-size:14px;">← 検索に戻る</a>
          &nbsp;|&nbsp;
          <a href="https://www.nicovideo.jp/search/${encodeURIComponent(q)}" target="_blank"
             style="color:#e6242b;font-size:14px;">ニコニコで開く ↗</a>
        </div>
        ${errorHTML}
        <div class="card-grid">${cards}</div>
      </div>
      ${SIDEBAR_JS}
    </body>
    </html>
  `);
});

// ニコニコランキングページ
app.get("/nico/ranking", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  const genre = req.query.genre || "all";
  const term  = req.query.term  || "24h";

  const genreOptions = [
    { v: "all",     l: "総合" },
    { v: "game",    l: "ゲーム" },
    { v: "anime",   l: "アニメ" },
    { v: "music",   l: "音楽" },
    { v: "sing",    l: "歌ってみた" },
    { v: "play",    l: "演奏してみた" },
    { v: "dance",   l: "踊ってみた" },
    { v: "vocaloid",l: "VOCALOID" },
    { v: "niconico-indies", l: "ニコニコインディーズ" },
    { v: "tech",    l: "技術・工作" },
    { v: "science", l: "解説・講座" },
    { v: "sport",   l: "スポーツ" },
  ];

  const termOptions = [
    { v: "24h",   l: "24時間" },
    { v: "week",  l: "週間" },
    { v: "month", l: "月間" },
    { v: "total", l: "合計" },
  ];

  let videos = [];
  let error  = null;
  try {
    videos = await getNicoRanking(genre, term);
  } catch (e) {
    error = e.message;
  }

  const genreSelect = genreOptions.map(o =>
    `<option value="${o.v}"${genre === o.v ? " selected" : ""}>${o.l}</option>`
  ).join("");

  const termSelect = termOptions.map(o =>
    `<option value="${o.v}"${term === o.v ? " selected" : ""}>${o.l}</option>`
  ).join("");

  const cards = videos.map((v, i) => `
    <form action="/nico/watch" method="post" style="display:inline;">
      <input type="hidden" name="id" value="${v.id}">
      <button style="all:unset;cursor:pointer;width:100%;">
        <div class="card nico-card" style="position:relative;">
          <div style="position:absolute;top:8px;left:8px;background:#e6242b;color:white;
               font-weight:bold;font-size:13px;padding:2px 8px;border-radius:6px;">
            ${i + 1}位
          </div>
          <img class="thumb" src="${v.thumb}" onerror="this.style.background='#eee'">
          <div style="margin-top:8px;font-weight:bold;font-size:14px;">${v.title}</div>
        </div>
      </button>
    </form>
  `).join("");

  res.send(`
    <html>
    <head>${CSS}</head>
    <body>
      ${SIDEBAR_HTML}
      <div id="main-content" class="main-content">
        <h2 style="color:#e6242b;">🏆 ニコニコランキング</h2>

        <form action="/nico/ranking" method="get"
              style="max-width:800px;margin:0 auto 20px;display:flex;gap:10px;flex-wrap:wrap;">
          <select name="genre" class="region-select" style="flex:1;min-width:140px;">
            ${genreSelect}
          </select>
          <select name="term" class="region-select" style="flex:1;min-width:120px;">
            ${termSelect}
          </select>
          <button type="submit" class="nico-btn" style="width:auto;padding:12px 20px;margin-bottom:15px;">
            🔄 更新
          </button>
        </form>

        ${error
          ? `<div style="text-align:center;color:#e74c3c;padding:20px;">⚠️ ${error}</div>`
          : (videos.length === 0
              ? `<div style="text-align:center;color:#999;padding:40px;">データを取得できませんでした</div>`
              : "")}

        <div class="card-grid">${cards}</div>
      </div>
      ${SIDEBAR_JS}
    </body>
    </html>
  `);
});

// ニコニコ動画視聴（埋め込みプレイヤー）
app.post("/nico/watch", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  const id = req.body.id;
  if (!id) return res.send("動画IDがありません");
  if (!/^(sm|nm|so|ax)\d+$/.test(id)) return res.send("動画IDが正しくありません");

  // タイトル取得
  const title = await getNicoVideoTitle(id);

  // 履歴保存
  saveHistory(user, "watch", id, title, "nico").catch(console.error);

  const embedUrl = `https://embed.nicovideo.jp/watch/${id}?autoplay=1&oldScript=1&referer=&from=0&allowProgrammaticFullScreen=1`;
  const numId = id.replace(/^[a-zA-Z]+/, "");
  const thumb = `https://nicovideo.cdn.nimg.jp/thumbnails/${numId}/${numId}`;

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
        .watch-player { flex: 1; min-width: 0; }
        .iframe-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 16/9;
        }
        .iframe-wrap iframe {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          border-radius: 12px;
          border: none;
          background: #000;
        }
        .action-bar { display:flex; gap:10px; margin-bottom:12px; flex-wrap:wrap; }
        .action-bar button, .action-bar a {
          width:auto; padding:8px 14px; font-size:13px; border-radius:6px; margin-bottom:0;
          text-decoration:none; display:inline-flex; align-items:center; gap:4px;
        }
        @media (max-width:900px) { .watch-layout { flex-direction:column; } }
      </style>
    </head>
    <body>
      ${SIDEBAR_HTML}
      <div id="main-content" class="main-content">
        <div class="watch-layout">
          <div class="watch-player">
            <h2 style="font-size:18px;margin-bottom:8px;">
              <span class="nico-badge">ニコニコ</span> ${title}
            </h2>

            <div class="action-bar">
              <button onclick="addNicoFav('${id}', \`${title.replace(/`/g, "\\`")}\`)"
                style="background:#f1c40f;color:#000;">
                ⭐ お気に入り追加
              </button>
              <a href="https://www.nicovideo.jp/watch/${id}" target="_blank"
                 style="background:#e6242b;color:white;">
                🎬 ニコニコで開く ↗
              </a>
            </div>

            <div class="iframe-wrap">
              <iframe src="${embedUrl}"
                allowfullscreen
                allow="autoplay; fullscreen; encrypted-media"
                referrerpolicy="no-referrer">
              </iframe>
            </div>

            <div style="margin-top:12px;">
              <a href="/" style="color:#3498db;">← ホームへ戻る</a>
              &nbsp;|&nbsp;
              <a href="/nico/ranking" style="color:#e6242b;">🏆 ランキング</a>
            </div>
          </div>
        </div>
      </div>
      ${SIDEBAR_JS}
      <script>
        function addNicoFav(id, title) {
          fetch("/nico/favorite/add", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoId: id, title: title })
          })
          .then(r => r.json())
          .then(d => {
            if (d.ok) alert("お気に入りに追加しました");
            else if (d.duplicate) alert("すでにお気に入り登録済みです");
            else alert("エラーが発生しました");
          })
          .catch(() => alert("通信エラー"));
        }
      </script>
    </body>
    </html>
  `);
});

// ニコニコお気に入り追加
app.post("/nico/favorite/add", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.status(401).json({ ok: false, error: "unauthorized" });

  const { videoId, title } = req.body;
  if (!videoId || !title) return res.status(400).json({ ok: false, error: "missing params" });

  const storedId = `nico:${videoId}`;

  try {
    const existing = await pool.query(
      "SELECT 1 FROM favorites WHERE user_id = $1 AND video_id = $2",
      [user, storedId]
    );
    if (existing.rows.length > 0) {
      return res.json({ ok: false, duplicate: true });
    }
    await pool.query(
      "INSERT INTO favorites (user_id, video_id, title) VALUES ($1, $2, $3)",
      [user, storedId, title]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("ニコニコお気に入り追加エラー:", e);
    res.json({ ok: false, error: e.message });
  }
});

// ======================================
// ■ YouTube 機能（既存）
// ======================================

// --------------------------------------
// Invidiousインスタンスリスト（WKT方式）
// --------------------------------------
let invidiousApis = null;

async function getInvidiousApis() {
  try {
    const res = await fetch("https://raw.githubusercontent.com/wakame02/wktopu/refs/heads/main/inv.json", {
      signal: AbortSignal.timeout(5000)
    });
    invidiousApis = await res.json();
    console.log("Invidiousリスト取得成功:", invidiousApis.length, "件");
  } catch (e) {
    console.error("Invidiousリスト取得失敗:", e);
    invidiousApis = [];
  }
}

getInvidiousApis();

// --------------------------------------
// WKT方式: ggvideo
// --------------------------------------
const MAX_API_WAIT_TIME = 3000;
const MAX_TOTAL_TIME = 10000;

async function ggvideo(videoId) {
  const startTime = Date.now();

  for (let i = 0; i < 20; i++) {
    if (Math.floor(Math.random() * 20) === 0) {
      await getInvidiousApis();
    }
  }

  if (!invidiousApis || invidiousApis.length === 0) {
    await getInvidiousApis();
  }

  if (!invidiousApis || invidiousApis.length === 0) {
    throw new Error("APIリストが取得できません");
  }

  for (const instance of invidiousApis) {
    try {
      const res = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        signal: AbortSignal.timeout(MAX_API_WAIT_TIME)
      });
      console.log(`試行: ${instance}/api/v1/videos/${videoId}`);

      if (!res.ok) throw new Error("bad status: " + res.status);

      const data = await res.json();

      if (data && data.formatStreams) {
        console.log("使用インスタンス:", instance);
        return data;
      } else {
        console.error(`formatStreamsが存在しない: ${instance}`);
      }
    } catch (e) {
      console.error(`失敗: ${instance} - ${e.message}`);
    }

    if (Date.now() - startTime >= MAX_TOTAL_TIME) {
      throw new Error("接続がタイムアウトしました");
    }
  }

  throw new Error("動画を取得する方法が見つかりません");
}

async function getYouTube(videoId) {
  const videoInfo = await ggvideo(videoId);
  const formatStreams = videoInfo.formatStreams || [];

  let streamUrl = [...formatStreams].reverse().map(s => s.url)[0];

  const audioStreams = videoInfo.adaptiveFormats || [];

  const highstreamUrl = audioStreams
    .filter(s => s.container === "webm" && s.resolution === "1080p")
    .map(s => s.url)[0] || null;

  const audioUrl = audioStreams
    .filter(s => s.container === "m4a" && s.audioQuality === "AUDIO_QUALITY_MEDIUM")
    .map(s => s.url)[0] || null;

  const streamUrls = audioStreams
    .filter(s => s.container === "webm" && s.resolution)
    .map(s => ({ url: s.url, resolution: s.resolution }));

  return {
    streamUrl,
    highstreamUrl,
    audioUrl,
    streamUrls,
    videoId,
    channelId: videoInfo.authorId || "",
    channelName: videoInfo.author || "",
    channelImage: (videoInfo.authorThumbnails || []).slice(-1)[0]?.url || "",
    title: videoInfo.title || "タイトル不明",
    description: videoInfo.descriptionHtml || "",
    viewCount: videoInfo.viewCount || "",
    likeCount: videoInfo.likeCount || "",
    related: (videoInfo.recommendedVideos || []).slice(0, 20).map(v => ({
      id: v.videoId,
      title: v.title
    }))
  };
}

// --------------------------------------
// edu用パラメータ取得（WKT方式）
// --------------------------------------
let cachedEduParams = null;
async function getEduParams() {
  if (cachedEduParams) return cachedEduParams;
  const urls = [
    "https://raw.githubusercontent.com/wakame02/wktopu/refs/heads/main/edu.text",
    "https://gitlab.com/wer02/wktopu/-/raw/main/edu.text"
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        cachedEduParams = await res.text();
        setTimeout(() => { cachedEduParams = null; }, 5 * 60 * 1000);
        return cachedEduParams;
      }
    } catch (e) {
      console.error(`edu.text取得失敗(${url}):`, e.message);
    }
  }
  return "";
}

// --------------------------------------
// YouTube 動画検索（60件）
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
// 設定ページ（再生方法の選択）
// --------------------------------------
app.get("/settings", (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  const currentMode = req.cookies.playbackMode || "normal";

  const modes = [
    {
      value: "normal",
      icon: "🎬",
      label: "通常",
      desc: "通常の再生方法で、Invidiousを通じてストリームを取得して再生を行います。ほとんどの環境で利用できます。"
    },
    {
      value: "edu",
      icon: "🎓",
      label: "edu（YouTube Education）",
      desc: "YouTubeEducationを埋め込んで再生を行います。学校や企業のフィルタリング環境でも視聴できる場合があります。"
    },
    {
      value: "nocookie",
      icon: "🍪",
      label: "nocookie（YouTube NoCookie）",
      desc: "YouTubeNoCookieを埋め込んで再生を行います。プライバシーを重視した埋め込み方式です。"
    }
  ];

  const modeCards = modes.map(m => `
    <div class="mode-card${currentMode === m.value ? " selected" : ""}" onclick="selectMode('${m.value}')">
      <label>
        <input type="radio" name="playbackMode" value="${m.value}"${currentMode === m.value ? " checked" : ""}>
        <div>
          <strong>${m.icon} ${m.label}${currentMode === m.value ? '<span class="current-mode-badge">現在</span>' : ''}</strong>
          <p>${m.desc}</p>
        </div>
      </label>
    </div>
  `).join("");

  res.send(`
    <html>
    <head>${CSS}</head>
    <body>
      ${SIDEBAR_HTML}
      <div id="main-content" class="main-content">
        <div class="settings-box">
          <h2>⚙️ 設定</h2>
          <h3>YouTube 再生方法を選択してください。設定はブラウザのCookieに保存されます。</h3>
          ${modeCards}
          <button onclick="saveSettings()" style="margin-top:10px;background:#27ae60;">
            💾 設定を保存
          </button>
          <div id="msg" style="margin-top:12px;color:#27ae60;font-size:14px;display:none;"></div>
          <hr style="margin:24px 0;border:none;border-top:1px solid #eee;">
          <h3 style="color:#e6242b;">🎬 ニコニコ動画について</h3>
          <p style="font-size:14px;color:#666;line-height:1.6;">
            ニコニコ動画は埋め込みプレイヤーで再生します。<br>
            一部の動画はニコニコアカウントでのログインが必要な場合があります。
          </p>
        </div>
      </div>
      ${SIDEBAR_JS}
      <script>
        function selectMode(val) {
          document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
          const card = document.querySelector('.mode-card input[value="' + val + '"]');
          if (card) {
            card.checked = true;
            card.closest('.mode-card').classList.add('selected');
          }
        }

        function saveSettings() {
          const selected = document.querySelector('input[name="playbackMode"]:checked');
          if (!selected) return;
          const mode = selected.value;
          document.cookie = "playbackMode=" + mode + "; path=/; max-age=31536000";
          const msg = document.getElementById("msg");
          msg.style.display = "block";
          const labels = { normal: "通常", edu: "edu（YouTube Education）", nocookie: "nocookie（YouTube NoCookie）" };
          msg.textContent = "✅ 再生方法を「" + (labels[mode] || mode) + "」に保存しました。";
          setTimeout(() => { msg.style.display = "none"; }, 3000);
        }
      </script>
    </body>
    </html>
  `);
});

// ======================================
// YouTube 動画視聴（メインルート）
// ======================================
app.post("/watch", async (req, res) => {
  const id = req.body.id;
  if (!id) return res.send("動画IDがありません");
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) return res.send("動画IDが正しくありません");

  const mode = req.cookies.playbackMode || "normal";
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  if (mode === "edu" || mode === "nocookie") {
    return handleEmbedWatchDirect(res, id, mode, user);
  }

  return handleNormalWatch(req, res, id);
});

async function handleEmbedWatchDirect(res, id, mode, user) {
  let videosrc;
  if (mode === "edu") {
    let eduParams = "";
    try {
      eduParams = await getEduParams();
    } catch (e) {
      console.error("edu params取得失敗:", e.message);
    }
    videosrc = `https://www.youtubeeducation.com/embed/${id}${eduParams}`;
  } else if (mode === "nocookie") {
    videosrc = `https://www.youtube-nocookie.com/embed/${id}`;
  } else {
    return res.send("不明な再生モードです");
  }

  let title = "動画";
  let channelName = "";
  let channelId = "";
  let related = [];
  try {
    const data = await getYouTube(id);
    title = data.title;
    channelName = data.channelName;
    channelId = data.channelId;
    related = data.related;
    if (user) {
      saveHistory(user, "watch", id, title, "yt").catch(console.error);
    }
  } catch (e) {
    console.error(`${mode}用情報取得失敗（埋め込みは継続）:`, e.message);
  }

  res.send(buildEmbedPage(id, videosrc, title, channelName, channelId, related, mode));
}

// --------------------------------------
// 通常再生（Invidiousストリーム）
// --------------------------------------
async function handleNormalWatch(req, res, id) {
  const user = req.cookies.user;
  let videoData;

  try {
    videoData = await getYouTube(id);
  } catch (e) {
    return res.redirect(`https://www.youtube.com/watch?v=${id}`);
  }

  const { streamUrl, audioUrl, title, channelName, channelId, related } = videoData;

  if (user) {
    saveHistory(user, "watch", id, title, "yt").catch(console.error);
  }

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
        .action-bar {
          display: flex;
          gap: 10px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .action-bar button, .action-bar a {
          width: auto;
          padding: 8px 14px;
          font-size: 13px;
          border-radius: 6px;
          margin-bottom: 0;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 4px;
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
          <div class="watch-player">
            <h2 style="font-size:18px;margin-bottom:8px;">${title}</h2>
            <div class="action-bar">
              <button onclick="addFav('${id}', \`${title.replace(/`/g, "\\`")}\`)"
                style="background:#f1c40f;color:#000;">
                ⭐ お気に入り追加
              </button>
              <a href="/settings" style="background:#95a5a6;color:white;">
                ⚙️ 再生方法: 通常
              </a>
            </div>
            <div class="channel-info">
              <span style="color:#3498db;font-weight:bold;cursor:pointer;"
                    onclick="goChannel('${channelId}')">
                📺 ${channelName}
              </span>
            </div>

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

          <div class="watch-related">
            <h3>関連動画</h3>
            ${relatedHTML}
          </div>
        </div>
      </div>
      ${SIDEBAR_JS}
      ${CHANNEL_NAV_JS}
      <script>
        function addFav(id, title) {
          fetch("/favorite/add", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoId: id, title: title })
          })
          .then(res => res.json())
          .then(data => {
            if (data.ok) alert("お気に入りに追加しました");
            else if (data.duplicate) alert("すでにお気に入り登録済みです");
            else alert("エラーが発生しました");
          })
          .catch(() => alert("通信エラー"));
        }
      </script>
    </body>
    </html>
  `);
}

// --------------------------------------
// edu 再生（YouTube Education 埋め込み）
// --------------------------------------
app.get("/watch/edu/:id", async (req, res) => {
  const id = req.params.id;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) return res.send("動画IDが正しくありません");

  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  let eduParams = "";
  try {
    eduParams = await getEduParams();
  } catch (e) {
    console.error("edu params取得失敗:", e.message);
  }

  const videosrc = `https://www.youtubeeducation.com/embed/${id}${eduParams}`;

  let title = "動画";
  let channelName = "";
  let channelId = "";
  let related = [];
  try {
    const data = await getYouTube(id);
    title = data.title;
    channelName = data.channelName;
    channelId = data.channelId;
    related = data.related;
    if (user) saveHistory(user, "watch", id, title, "yt").catch(console.error);
  } catch (e) {
    console.error("edu用情報取得失敗（埋め込みは継続）:", e.message);
  }

  res.send(buildEmbedPage(id, videosrc, title, channelName, channelId, related, "edu"));
});

// --------------------------------------
// nocookie 再生（YouTube NoCookie 埋め込み）
// --------------------------------------
app.get("/watch/nocookie/:id", async (req, res) => {
  const id = req.params.id;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) return res.send("動画IDが正しくありません");

  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  const videosrc = `https://www.youtube-nocookie.com/embed/${id}`;

  let title = "動画";
  let channelName = "";
  let channelId = "";
  let related = [];
  try {
    const data = await getYouTube(id);
    title = data.title;
    channelName = data.channelName;
    channelId = data.channelId;
    related = data.related;
    if (user) saveHistory(user, "watch", id, title, "yt").catch(console.error);
  } catch (e) {
    console.error("nocookie用情報取得失敗（埋め込みは継続）:", e.message);
  }

  res.send(buildEmbedPage(id, videosrc, title, channelName, channelId, related, "nocookie"));
});

// --------------------------------------
// 埋め込みページ共通ビルダー（YouTube）
// --------------------------------------
function buildEmbedPage(id, videosrc, title, channelName, channelId, related, mode) {
  const modeLabel = mode === "edu" ? "edu（YouTube Education）" : "nocookie（YouTube NoCookie）";
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

  return `
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
        .watch-player { flex: 1; min-width: 0; }
        .iframe-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 16/9;
        }
        .iframe-wrap iframe {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          border-radius: 12px;
          border: none;
        }
        .watch-related {
          width: 380px;
          flex-shrink: 0;
          max-height: 90vh;
          overflow-y: auto;
        }
        .watch-related h3 { font-size:15px; margin-bottom:12px; color:#2c3e50; }
        .channel-info { display:flex; align-items:center; gap:10px; margin:12px 0; font-size:14px; color:#555; }
        .action-bar { display:flex; gap:10px; margin-bottom:12px; flex-wrap:wrap; }
        .action-bar button, .action-bar a {
          width:auto; padding:8px 14px; font-size:13px; border-radius:6px; margin-bottom:0;
          text-decoration:none; display:inline-flex; align-items:center; gap:4px;
        }
        @media (max-width:900px) { .watch-layout { flex-direction:column; } .watch-related { width:100%; } }
      </style>
    </head>
    <body>
      ${SIDEBAR_HTML}
      <div id="main-content" class="main-content">
        <div class="watch-layout">
          <div class="watch-player">
            <h2 style="font-size:18px;margin-bottom:8px;">${title}</h2>
            <div class="action-bar">
              <button onclick="addFav('${id}', \`${title.replace(/`/g, "\\`")}\`)"
                style="background:#f1c40f;color:#000;">
                ⭐ お気に入り追加
              </button>
              <a href="/settings" style="background:#95a5a6;color:white;">
                ⚙️ 再生方法: ${modeLabel}
              </a>
            </div>
            <div class="channel-info">
              <span style="color:#3498db;font-weight:bold;cursor:pointer;"
                    onclick="goChannel('${channelId}')">
                📺 ${channelName}
              </span>
            </div>

            <div class="iframe-wrap">
              <iframe src="${videosrc}" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
            </div>

            <div style="margin-top:12px;">
              <a href="/" style="color:#3498db;">← ホームへ戻る</a>
              &nbsp;|&nbsp;
              <a href="https://www.youtube.com/watch?v=${id}" target="_blank" style="color:#e74c3c;">
                YouTubeで開く
              </a>
            </div>
          </div>

          <div class="watch-related">
            <h3>関連動画</h3>
            ${relatedHTML}
          </div>
        </div>
      </div>
      ${SIDEBAR_JS}
      ${CHANNEL_NAV_JS}
      <script>
        function addFav(id, title) {
          fetch("/favorite/add", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoId: id, title: title })
          })
          .then(res => res.json())
          .then(data => {
            if (data.ok) alert("お気に入りに追加しました");
            else if (data.duplicate) alert("すでにお気に入り登録済みです");
            else alert("エラーが発生しました");
          })
          .catch(() => alert("通信エラー"));
        }
      </script>
    </body>
    </html>
  `;
}

// --------------------------------------
// チャンネル検索（GET）
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
// チャンネル検索結果（POST）
// --------------------------------------
app.post("/channel-search/result", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  const q = req.body.q;
  const region = req.body.region || "jp";

  if (!q) return res.send("検索ワードがありません");

  let url;
  if (region === "global") {
    url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAg%253D%253D`;
  } else {
    url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAg%253D%253D&hl=ja&gl=JP`;
  }

  let html;
  try {
    html = await fetch(url, { signal: AbortSignal.timeout(8000) }).then(r => r.text());
  } catch (e) {
    return res.send("YouTubeへの接続がタイムアウトしました。再度お試しください。");
  }

  const jsonText = html.match(/var ytInitialData = (.*?);<\/script>/s);
  if (!jsonText) return res.send("データを取得できませんでした");

  let data;
  try {
    data = JSON.parse(jsonText[1]);
  } catch {
    return res.send("データの解析に失敗しました");
  }

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
            <div class="card" onclick="goChannel('${c.id}')" style="cursor:pointer;">
              <img class="thumb" src="${c.icon}">
              <div style="margin-top:10px;font-weight:bold;">${c.title}</div>
            </div>
          `).join("")}
        </div>
      </div>
      ${SIDEBAR_JS}
      ${CHANNEL_NAV_JS}
    </body>
    </html>
  `);
});

// --------------------------------------
// チャンネル動画一覧（GET & POST 両対応）
// --------------------------------------
async function handleChannelVideos(req, res) {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  const id = req.body?.id || req.query.id;
  if (!id) return res.send("チャンネルIDがありません");

  const url = `https://www.youtube.com/channel/${id}/videos?hl=ja&gl=JP`;

  let html;
  try {
    html = await fetch(url, { signal: AbortSignal.timeout(8000) }).then(r => r.text());
  } catch (e) {
    return res.send("YouTubeへの接続がタイムアウトしました。再度お試しください。");
  }

  const jsonText =
    html.match(/ytInitialData"\]\s*=\s*(\{.*?\});/) ||
    html.match(/var ytInitialData = (\{.*?\});/) ||
    html.match(/window\["ytInitialData"\]\s*=\s*(\{.*?\});/);

  if (!jsonText) return res.send("データを取得できませんでした");

  let data;
  try {
    data = JSON.parse(jsonText[1]);
  } catch {
    return res.send("データの解析に失敗しました");
  }

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
}

app.get("/channel-videos", handleChannelVideos);
app.post("/channel-videos", handleChannelVideos);

// --------------------------------------
// お気に入り機能（YouTube + ニコニコ 両対応）
// --------------------------------------
app.get("/favorites", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  const result = await pool.query(
    "SELECT * FROM favorites WHERE user_id = $1 ORDER BY created_at DESC",
    [user]
  );

  const list = result.rows.map(v => buildFavCard(v)).join("");

  res.send(`
    <html>
    <head>${CSS}</head>
    <body>
      ${SIDEBAR_HTML}
      <div id="main-content" class="main-content">
        <h2>⭐ お気に入り</h2>
        <div class="card-grid">${list}</div>
      </div>
      ${SIDEBAR_JS}
    </body>
    </html>
  `);
});

app.post("/favorite/add", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.status(401).json({ ok: false, error: "unauthorized" });

  const { videoId, title } = req.body;
  if (!videoId || !title) return res.status(400).json({ ok: false, error: "missing params" });

  try {
    const existing = await pool.query(
      "SELECT 1 FROM favorites WHERE user_id = $1 AND video_id = $2",
      [user, videoId]
    );
    if (existing.rows.length > 0) {
      return res.json({ ok: false, duplicate: true });
    }

    await pool.query(
      "INSERT INTO favorites (user_id, video_id, title) VALUES ($1, $2, $3)",
      [user, videoId, title]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("お気に入り追加エラー:", e);
    res.json({ ok: false, error: e.message });
  }
});

// --------------------------------------
// 履歴ページ（YouTube + ニコニコ 両対応）
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

  html += data.map(item => buildHistoryCard(item)).join("");

  html += `
        <br><center><a href="/">ホームへ戻る</a></center>
      </div>
      ${SIDEBAR_JS}
      ${WATCH_NAV_JS}
    </body>
    </html>
  `;

  res.send(html);
});

app.post("/history/delete", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");
  await pool.query("DELETE FROM history WHERE user_id = $1", [user]);
  res.redirect("/history");
});

// --------------------------------------
// 管理者ページ（YouTube + ニコニコ 両対応）
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
    allHistoryHTML += data.map(item => {
      const isNico = item.video_id.startsWith("nico:");
      const cleanId = isNico ? item.video_id.replace("nico:", "") : item.video_id;
      const thumb = getThumbUrl(item.video_id);
      const badge = isNico
        ? `<span class="nico-badge">ニコニコ</span>`
        : `<span class="yt-badge">YouTube</span>`;
      const clickFn = isNico
        ? `postNicoWatch('${cleanId}')`
        : `postWatch('${cleanId}')`;
      return `
        <div class="card" style="margin-bottom:12px;display:flex;gap:12px;align-items:center;">
          <img src="${thumb}"
               style="width:120px;height:68px;border-radius:8px;object-fit:cover;flex-shrink:0;background:#eee;">
          <div>
            <div style="font-size:12px;color:#999;">${formatDateJP(item.created_at)} ${badge}</div>
            <a href="#" onclick="${clickFn}" style="font-weight:bold;color:#2c3e50;text-decoration:none;">
              ${item.title}
            </a>
          </div>
        </div>
      `;
    }).join("");

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
        <p style="color:#e74c3c;font-size:13px;text-align:center;">
          ※ユーザーが自分の履歴を削除しても、この画面の記録は消えません
        </p>
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
          function postNicoWatch(id) {
            const form = document.createElement("form");
            form.method = "POST";
            form.action = "/nico/watch";
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

app.post("/admin/delete-user", async (req, res) => {
  const pass = req.body.pass;
  const user = req.body.user;
  if (pass !== ADMIN_PASSWORD) return res.send("パスワードが違います");
  await pool.query("DELETE FROM admin_history WHERE user_id = $1", [user]);
  res.redirect(`/admin?pass=${ADMIN_PASSWORD}`);
});

// uptimerobot用
app.get("/health", (req, res) => {
  res.status(200).send("OK");
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

import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import cookieParser from "cookie-parser";

const app = express();
app.disable("x-powered-by");

const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

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

  .history-card {
    background: white;
    padding: 12px;
    margin: 10px 0;
    border-radius: 10px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.1);
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

  .danger {
    background: #e74c3c;
  }

  .danger:hover {
    background: #c0392b;
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
  <a href="/history"><span class="sidebar-icon">🕘</span> <span class="sidebar-text">履歴</span></a>
  <a href="/admin"><span class="sidebar-icon">⚙️</span> <span class="sidebar-text">管理者ページ</span></a>
</div>
`;

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
// 固定ユーザー管理
// --------------------------------------
function loadUsers() {
  if (!fs.existsSync("users.json")) return [];
  return JSON.parse(fs.readFileSync("users.json", "utf8"));
}

// --------------------------------------
// 履歴保存（ユーザー用 + 管理者用）
// --------------------------------------
function saveHistory(user, keyword, videoId, title) {
  const userFile = `history_user_${user}.json`;
  const adminFile = `history_admin_${user}.json`;

  let userData = [];
  let adminData = [];

  if (fs.existsSync(userFile)) {
    userData = JSON.parse(fs.readFileSync(userFile, "utf8"));
  }
  if (fs.existsSync(adminFile)) {
    adminData = JSON.parse(fs.readFileSync(adminFile, "utf8"));
  }

  const entry = {
    keyword,
    videoId,
    title,
    time: new Date().toISOString()
  };

  userData.unshift(entry);
  adminData.unshift(entry);

  fs.writeFileSync(userFile, JSON.stringify(userData, null, 2));
  fs.writeFileSync(adminFile, JSON.stringify(adminData, null, 2));
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
app.get("/search", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  const q = req.query.q;
  if (!q) return res.send("検索ワードがありません");

  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&gl=JP&hl=ja`;
  const html = await fetch(url).then(r => r.text());

  // 動画抽出
  const videoMatches = [...html.matchAll(/"videoId":"(.*?)".*?"title":\{"runs":\[\{"text":"(.*?)"\}\]/gs)];
  const videos = videoMatches.slice(0, 60).map(m => ({
    type: "video",
    id: m[1],
    title: m[2]
  }));

  // 履歴保存（動画が1件以上あれば）
  if (videos.length > 0) {
    saveHistory(user, q, videos[0].id, videos[0].title);
  }

  let list = `
    <html>
    <head>${CSS}</head>
    <body>

      ${SIDEBAR_HTML}

      <div id="main-content" class="main-content">
        <h2>動画検索結果: ${q}</h2>
        <div class="card-grid">
  `;

  list += videos.map(v => `
    <div class="card">
      <a href="/watch?v=${v.id}">
        <img class="thumb" src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg">
        <div style="margin-top:10px;font-weight:bold;">${v.title}</div>
      </a>
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
// チャンネル動画一覧（内部ページ）
// --------------------------------------
app.get("/channel-videos", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  const id = req.query.id;
  if (!id) return res.send("チャンネルIDがありません");

  // チャンネルの動画一覧ページを取得
  const url = `https://www.youtube.com/channel/${id}/videos`;
  const html = await fetch(url).then(r => r.text());

  // ytInitialData を抽出（複数パターン対応）
  let jsonText =

\s*=\s*(\{.*?\});/) ||
    html.match(/var ytInitialData = (\{.*?\});/) ||
    html.match(/window

\["ytInitialData"\]

\s*=\s*(\{.*?\});/);

  if (!jsonText) {
    return res.send("データを取得できませんでした（ytInitialData が見つかりません）");
  }

  const data = JSON.parse(jsonText[1]);

  // 動画一覧を抽出
  const videos = [];

  function scan(obj) {
    if (!obj || typeof obj !== "object") return;

    // gridVideoRenderer（チャンネル動画ページ）
    if (obj.gridVideoRenderer) {
      const v = obj.gridVideoRenderer;
      videos.push({
        id: v.videoId,
        title: v.title?.simpleText || v.title?.runs?.[0]?.text || "No Title",
        thumb: v.thumbnail?.thumbnails?.slice(-1)[0]?.url || ""
      });
    }

    // videoRenderer（検索結果など）
    if (obj.videoRenderer) {
      const v = obj.videoRenderer;
      videos.push({
        id: v.videoId,
        title: v.title?.runs?.[0]?.text || "No Title",
        thumb: v.thumbnail?.thumbnails?.slice(-1)[0]?.url || ""
      });
    }

    for (const key in obj) scan(obj[key]);
  }

  scan(data);

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
      <a href="/watch?v=${v.id}">
        <img class="thumb" src="${v.thumb}">
        <div style="margin-top:10px;font-weight:bold;">${v.title}</div>
      </a>
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
// チャンネル検索ページ（入力フォーム）
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
        <center>
          <form action="/channel-search/result">
            <input type="text" name="q" placeholder="チャンネル名" required style="max-width:400px;">
            <button style="width:200px;">検索</button>
          </form>
        </center>
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
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAg%253D%253D`;

  const html = await fetch(url).then(r => r.text());

  // ytInitialData を抽出
  const jsonText = html.match(/var ytInitialData = (.*?);<\/script>/s);
  if (!jsonText) return res.send("データを取得できませんでした");

  const data = JSON.parse(jsonText[1]);

  // channelRenderer をすべて抽出
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

  // 最大 60 件
  const list60 = channels.slice(0, 60);

  let list = `
    <html>
    <head>${CSS}</head>
    <body>

      ${SIDEBAR_HTML}

      <div id="main-content" class="main-content">
        <h2>チャンネル検索結果: ${q}</h2>
        <div class="card-grid">
  `;

  // ★★★ ここを修正 ★★★
  list += list60.map(c => `
    <div class="card" onclick="location.href='/channel-videos?id=${c.id}'" style="cursor:pointer;">
      <img class="thumb" src="${c.icon}" style="pointer-events:none;">
      <div style="margin-top:10px;font-weight:bold;">${c.title}</div>
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
// 動画再生
// --------------------------------------
app.get("/watch", (req, res) => {
  const id = req.query.v;
  if (!id) return res.send("動画IDがありません");

  res.send(`
    <html>
    <head>${CSS}</head>
    <body>

      ${SIDEBAR_HTML}

      <div id="main-content" class="main-content">
        <h2>動画再生</h2>
        <center>
          <iframe width="560" height="315"
            src="https://www.youtube.com/embed/${id}"
            frameborder="0" allowfullscreen></iframe>
          <br><br>
          <a href="/">ホーム</a>
        </center>
      </div>

      ${SIDEBAR_JS}

    </body>
    </html>
  `);
});

// --------------------------------------
// 履歴ページ（ユーザー用）
// --------------------------------------
app.get("/history", (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  const file = `history_user_${user}.json`;

  let data = [];
  if (fs.existsSync(file)) {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  }

  data.sort((a, b) => new Date(b.time) - new Date(a.time));

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
      ${item.time}<br>
      <strong>${item.keyword}</strong><br>
      <a href="/watch?v=${item.videoId}">
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

    </body>
    </html>
  `;

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

app.get("/admin", (req, res) => {
  const pass = req.query.pass;

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

  const files = fs.readdirSync("./").filter(f => f.startsWith("history_admin_"));

  let allHistoryHTML = "";
  let deleteButtonsHTML = "";

  for (const file of files) {
    const user = file.replace("history_admin_", "").replace(".json", "");
    let data = JSON.parse(fs.readFileSync(file, "utf8"));

    data.sort((a, b) => new Date(b.time) - new Date(a.time));

    allHistoryHTML += `<h3>${user}</h3>`;
    allHistoryHTML += data.map(item => `
      <div class="history-card">
        ${item.time}<br>
        <strong>${item.keyword}</strong><br>
        <a href="/watch?v=${item.videoId}">
          ${item.title}
        </a>
      </div>
    `).join("");

    deleteButtonsHTML += `
      <form method="POST" action="/admin/delete-user">
        <input type="hidden" name="user" value="${user}">
        <input type="hidden" name="pass" value="${ADMIN_PASSWORD}">
        <button class="danger" style="width:200px;">${user} の履歴を削除</button>
      </form>
      <br>
    `;
  }

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
        </script>
      </div>

      ${SIDEBAR_JS}

    </body>
    </html>
  `);
});

// --------------------------------------
// 管理者：ユーザー履歴削除（本物）
// --------------------------------------
app.post("/admin/delete-user", (req, res) => {
  const { user, pass } = req.body;

  if (pass !== ADMIN_PASSWORD) {
    return res.send("管理者パスワードが違います");
  }

  const file = `history_admin_${user}.json`;

  if (fs.existsSync(file)) fs.unlinkSync(file);

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
// サーバー起動
// --------------------------------------
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import cookieParser from "cookie-parser";

const app = express();
app.disable("x-powered-by");

const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 共通CSS
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

  /* 中央配置フォーム（ログイン用） */
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

  a {
    color: #3498db;
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  /* カードレイアウト（検索結果） */
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

  /* YouTube風サムネイル */
  .thumb {
    width: 100%;
    border-radius: 10px;
    transition: transform 0.25s ease, box-shadow 0.25s ease;
  }

  .thumb:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 16px rgba(0,0,0,0.25);
  }

  /* 履歴カード */
  .history-card {
    background: white;
    padding: 12px;
    margin: 10px 0;
    border-radius: 10px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  }

  /* 管理者タブ */
  .tabs {
    display: flex;
    border-bottom: 2px solid #ddd;
    margin-bottom: 20px;
  }

  .tab {
    padding: 12px 20px;
    cursor: pointer;
    border-bottom: 3px solid transparent;
    font-weight: bold;
    color: #555;
  }

  .tab.active {
    border-bottom: 3px solid #3498db;
    color: #3498db;
  }

  .tab-content {
    display: none;
  }

  .tab-content.active {
    display: block;
  }
</style>
`;

// ------------------------------
// 固定ユーザー管理
// ------------------------------
function loadUsers() {
  if (!fs.existsSync("users.json")) return [];
  return JSON.parse(fs.readFileSync("users.json", "utf8"));
}

// ------------------------------
// 履歴保存
// ------------------------------
function saveHistory(user, keyword, videoId, title) {
  const file = `history_${user}.json`;

  let data = [];
  if (fs.existsSync(file)) {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  }

  data.unshift({
    keyword,
    videoId,
    title,
    time: new Date().toISOString()
  });

  data = data.slice(0, 100);

  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ------------------------------
// ログイン画面（デザイン版）
// ------------------------------
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

// ------------------------------
// ホーム
// ------------------------------
app.get("/", (req, res) => {
  const user = req.cookies.user;

  if (!user) return res.redirect("/login");

  res.send(`
    <html>
    <head>${CSS}</head>
    <body style="padding:20px;">
      <h2>ようこそ ${user} さん</h2>
      <center>
        <form action="/search">
          <input type="text" name="q" placeholder="検索ワード" required style="max-width:400px;">
          <button style="width:200px;">検索</button>
        </form>
        <br>
        <a href="/history">検索履歴</a><br><br>
        <a href="/admin">管理者ページ</a><br><br>
        <a href="/logout">ログアウト</a>
      </center>
    </body>
    </html>
  `);
});

// ------------------------------
// YouTube検索（デザイン版）
// ------------------------------
app.get("/search", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  const q = req.query.q;
  if (!q) return res.send("検索ワードがありません");

  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&gl=JP&hl=ja`;
  const html = await fetch(url).then(r => r.text());

  const matches = [...html.matchAll(/"videoId":"(.*?)".*?"title":\{"runs":

\[\{"text":"(.*?)"\}\]

/gs)];

  const videos = matches.slice(0, 42).map(m => ({
    id: m[1],
    title: m[2]
  }));

  if (videos.length > 0) {
    saveHistory(user, q, videos[0].id, videos[0].title);
  }

  let list = `
    <html>
    <head>${CSS}</head>
    <body>
      <h2>検索結果: ${q}</h2>
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
      <center><a href="/">ホームへ戻る</a></center>
    </body>
    </html>
  `;

  res.send(list);
});

// ------------------------------
// 動画再生
// ------------------------------
app.get("/watch", (req, res) => {
  const id = req.query.v;
  if (!id) return res.send("動画IDがありません");

  res.send(`
    <html>
    <head>${CSS}</head>
    <body style="padding:20px;">
      <h2>動画再生</h2>
      <center>
        <iframe width="560" height="315"
          src="https://www.youtube.com/embed/${id}"
          frameborder="0" allowfullscreen></iframe>
        <br><br>
        <a href="/">ホーム</a>
      </center>
    </body>
    </html>
  `);
});

// ------------------------------
// 履歴ページ（デザイン版）
// ------------------------------
app.get("/history", (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  const file = `history_${user}.json`;

  let data = [];
  if (fs.existsSync(file)) {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  }

  data.sort((a, b) => new Date(b.time) - new Date(a.time));

  let html = `
    <html>
    <head>${CSS}</head>
    <body style="padding:20px;">
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
      </a><br><br>
      <a href="/history/delete-one?index=${index}" style="color:red;">この履歴を削除</a>
    </div>
  `).join("");

  html += `
      <br><center><a href="/">ホームへ戻る</a></center>
    </body>
    </html>
  `;

  res.send(html);
});

// ------------------------------
// 履歴削除
// ------------------------------
app.post("/history/delete", (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  const file = `history_${user}.json`;

  if (fs.existsSync(file)) fs.unlinkSync(file);

  res.redirect("/history");
});

app.get("/history/delete-one", (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.redirect("/login");

  const index = parseInt(req.query.index);
  const file = `history_${user}.json`;

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

// ------------------------------
// 管理者ページ（タブ形式）
// ------------------------------
const ADMIN_PASSWORD = "jagdyufr5t62";

app.get("/admin", (req, res) => {
  const pass = req.query.pass;

  if (pass !== ADMIN_PASSWORD) {
    return res.send(`
      <html>
      <head>${CSS}</head>
      <body>
        <div class="center-box">
          <h2>管理者ログイン</h2>
          <form>
            <input name="pass" type="password" placeholder="管理者パスワード" required>
            <button>ログイン</button>
          </form>
        </div>
      </body>
      </html>
    `);
  }

  const files = fs.readdirSync("./").filter(f => f.startsWith("history_") && f.endsWith(".json"));

  let allHistoryHTML = "";
  let deleteButtonsHTML = "";

  for (const file of files) {
    const user = file.replace("history_", "").replace(".json", "");
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
    <body style="padding:20px;">
      <h2>管理者ページ</h2>

      <div class="tabs">
        <div class="tab active" id="tab-all" onclick="openTab('all')">全履歴</div>
        <div class="tab" id="tab-search" onclick="openTab('search')">検索</div>
        <div class="tab" id="tab-delete" onclick="openTab('delete')">ユーザー削除</div>
      </div>

      <div class="tab-content active" id="content-all">
        ${allHistoryHTML}
      </div>

      <div class="tab-content" id="content-search">
        <form method="GET" action="/admin">
          <input type="hidden" name="pass" value="${ADMIN_PASSWORD}">
          <input name="q" placeholder="キーワード検索">
          <button>検索</button>
        </form>
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

      <br><center><a href="/">ホームへ戻る</a></center>
    </body>
    </html>
  `);
});

// ------------------------------
app.post("/admin/delete-user", (req, res) => {
  const { user, pass } = req.body;

  if (pass !== ADMIN_PASSWORD) {
    return res.send("管理者パスワードが違います");
  }

  const file = `history_${user}.json`;

  if (fs.existsSync(file)) fs.unlinkSync(file);

  res.redirect(`/admin?pass=${ADMIN_PASSWORD}`);
});

// ------------------------------
app.listen(PORT, () => console.log("Server running"));

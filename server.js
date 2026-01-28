import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import cookieParser from "cookie-parser";

const app = express();
app.disable("x-powered-by");

const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ------------------------------
// ユーザー管理（固定ユーザー）
// ------------------------------
function loadUsers() {
  if (!fs.existsSync("users.json")) return [];
  return JSON.parse(fs.readFileSync("users.json", "utf8"));
}

// ------------------------------
// 履歴保存（ユーザー別）
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
// ホーム
// ------------------------------
app.get("/", (req, res) => {
  const user = req.cookies.user;

  if (!user) {
    return res.send(`
      <h2>ホーム</h2>
      <a href="/login">ログイン</a>
    `);
  }

  res.send(`
    <h2>ようこそ ${user} さん</h2>
    <form action="/search">
      <input type="text" name="q" placeholder="検索ワード" required>
      <button>検索</button>
    </form>
    <br>
    <a href="/history">検索履歴</a><br>
    <a href="/logout">ログアウト</a>
  `);
});

// ------------------------------
// ログイン
// ------------------------------
app.get("/login", (req, res) => {
  res.send(`
    <h2>ログイン</h2>
    <form method="POST" action="/login">
      <input name="user" placeholder="ユーザー名" required><br>
      <input name="pass" type="password" placeholder="パスワード" required><br>
      <button>ログイン</button>
    </form>
  `);
});

app.post("/login", (req, res) => {
  const { user, pass } = req.body;
  const users = loadUsers();

  const found = users.find(u => u.user === user && u.pass === pass);
  if (!found) return res.send("ユーザー名またはパスワードが違います");

  res.cookie("user", user, { httpOnly: true });
  res.send("ログイン成功！<br><a href='/'>ホームへ</a>");
});

// ------------------------------
// ログアウト
// ------------------------------
app.get("/logout", (req, res) => {
  res.clearCookie("user");
  res.send("ログアウトしました<br><a href='/login'>ログインへ</a>");
});

// ------------------------------
// 検索
// ------------------------------
app.get("/search", async (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.send("ログインしてください<br><a href='/login'>ログイン</a>");

  const q = req.query.q;
  if (!q) return res.send("検索ワードがありません");

  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&gl=JP&hl=ja`;
  const html = await fetch(url).then(r => r.text());

  const matches = [...html.matchAll(/"videoId":"(.*?)".*?"title":\{"runs":\[\{"text":"(.*?)"\}\]/gs)];

  const videos = matches.slice(0, 42).map(m => ({
    id: m[1],
    title: m[2]
  }));

  if (videos.length > 0) {
    saveHistory(user, q, videos[0].id, videos[0].title);
  }

  let list = `
    <h2>検索結果: ${q}</h2>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;">
  `;

  list += videos.map(v => `
    <div>
      <a href="/watch?v=${v.id}">
        <img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" style="width:100%;border-radius:8px;">
        <div style="margin-top:5px;font-weight:bold;">${v.title}</div>
      </a>
    </div>
  `).join("");

  list += "</div><br><a href='/'>戻る</a>";

  res.send(list);
});

// ------------------------------
// 動画再生
// ------------------------------
app.get("/watch", (req, res) => {
  const id = req.query.v;
  if (!id) return res.send("動画IDがありません");

  res.send(`
    <h2>動画再生</h2>
    <iframe width="560" height="315"
      src="https://www.youtube.com/embed/${id}"
      frameborder="0" allowfullscreen></iframe>
    <br><br>
    <a href="/">ホーム</a>
  `);
});

// ------------------------------
// 履歴ページ（ユーザー別）
// ------------------------------
app.get("/history", (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.send("ログインしてください");

  const file = `history_${user}.json`;

  let data = [];
  if (fs.existsSync(file)) {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  }

  let html = `
    <h2>${user} さんの検索履歴</h2>
    <form action="/history/delete" method="POST">
      <button style="margin-bottom:20px;">履歴をすべて削除</button>
    </form>
    <ul>
  `;

  html += data.map((item, index) => `
    <li>
      ${item.time} — <strong>${item.keyword}</strong><br>
      <a href="/watch?v=${item.videoId}">
        ${item.title}（${item.videoId}）
      </a><br>
      <a href="/history/delete-one?index=${index}" style="color:red;">この履歴を削除</a>
    </li>
  `).join("");

  html += "</ul><br><a href='/'>ホーム</a>";

  res.send(html);
});

// ------------------------------
// 履歴削除（全削除）
// ------------------------------
app.post("/history/delete", (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.send("ログインしてください");

  const file = `history_${user}.json`;

  if (fs.existsSync(file)) fs.unlinkSync(file);

  res.send(`
    <h2>履歴を削除しました</h2>
    <a href="/history">戻る</a>
  `);
});

// ------------------------------
// 履歴削除（個別）
// ------------------------------
app.get("/history/delete-one", (req, res) => {
  const user = req.cookies.user;
  if (!user) return res.send("ログインしてください");

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

  res.send(`
    <h2>履歴を削除しました</h2>
    <a href="/history">戻る</a>
  `);
});

// ------------------------------
app.listen(PORT, () => console.log("Server running"));

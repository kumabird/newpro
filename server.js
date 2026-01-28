import express from "express";
import fetch from "node-fetch";
import fs from "fs";

const app = express();
app.disable("x-powered-by");

const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));

// ------------------------------
// 履歴保存関数
// ------------------------------
function saveHistory(keyword, videoId, title) {
  const file = "history.json";

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

  // 最大100件
  data = data.slice(0, 100);

  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ------------------------------
// ホーム
// ------------------------------
app.get("/", (req, res) => {
  res.send(`
    <h2>YouTube Viewer（API不要）</h2>
    <form action="/search">
      <input type="text" name="q" placeholder="検索ワードを入力" style="width:300px;">
      <button type="submit">検索</button>
    </form>
    <br>
    <a href="/history">検索履歴を見る（パスコード必要）</a>
  `);
});

// ------------------------------
// 検索
// ------------------------------
app.get("/search", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.send("検索ワードがありません");

  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&gl=JP&hl=ja`;
  const html = await fetch(url).then(r => r.text());

  // ★ 正規表現は必ず1行
  const matches = [...html.matchAll(/"videoId":"(.*?)".*?"title":\{"runs":\[\{"text":"(.*?)"\}\]/gs)];

  const videos = matches.slice(0, 42).map(m => ({
    id: m[1],
    title: m[2]
  }));

  // ★ 履歴保存（1件目）
  if (videos.length > 0) {
    saveHistory(q, videos[0].id, videos[0].title);
  }

  let list = `
    <h2>検索結果: ${q}</h2>
    <div style="
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    ">
  `;

  list += videos.map(v => `
    <div>
      <a href="/watch?v=${v.id}">
        <img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" style="width:100%; border-radius:8px;">
        <div style="margin-top:5px; font-weight:bold;">${v.title}</div>
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
// Shorts 再生
// ------------------------------
app.get("/shorts", (req, res) => {
  const id = req.query.v;
  if (!id) return res.send("Shorts ID がありません");

  res.send(`
    <h2>Shorts 再生</h2>
    <iframe width="315" height="560"
      src="https://www.youtube.com/embed/${id}"
      frameborder="0" allowfullscreen></iframe>
    <br><br>
    <a href="/">ホーム</a>
  `);
});

// ------------------------------
// チャンネル動画一覧
// ------------------------------
app.get("/channel", async (req, res) => {
  const id = req.query.id;
  if (!id) return res.send("チャンネルIDがありません");

  const url = `https://www.youtube.com/channel/${id}/videos`;
  const html = await fetch(url).then(r => r.text());

  // ★ 必ず1行
  const matches = [...html.matchAll(/"videoId":"(.*?)".*?"title":\{"runs":\[\{"text":"(.*?)"\}\]/gs)];

  const videos = matches.slice(0, 42).map(m => ({
    id: m[1],
    title: m[2]
  }));

  let list = `
    <h2>チャンネル動画一覧</h2>
    <div style="
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    ">
  `;

  list += videos.map(v => `
    <div>
      <a href="/watch?v=${v.id}">
        <img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" style="width:100%; border-radius:8px;">
        <div style="margin-top:5px; font-weight:bold;">${v.title}</div>
      </a>
    </div>
  `).join("");

  list += "</div><br><a href='/'>戻る</a>";

  res.send(list);
});

// ------------------------------
// 履歴ページ（パスコード必須）
// ------------------------------
app.get("/history", (req, res) => {
  const pass = req.query.pass;

  if (pass !== '1JaGdYufr5t&"') {
    return res.send(`
      <h2>履歴ページ（パスコード必須）</h2>
      <form>
        <input type="password" name="pass" placeholder="パスコードを入力">
        <button type="submit">表示</button>
      </form>
    `);
  }

  let data = [];
  if (fs.existsSync("history.json")) {
    data = JSON.parse(fs.readFileSync("history.json", "utf8"));
  }

  let html = `
    <h2>検索履歴</h2>
    <form action="/history/delete" method="POST">
      <input type="hidden" name="pass" value="${pass}">
      <button type="submit" style="margin-bottom:20px;">履歴をすべて削除</button>
    </form>
    <ul>
  `;

  html += data
    .map(
      (item, index) =>
        `<li>
          ${item.time} — <strong>${item.keyword}</strong><br>
          <a href="/watch?v=${item.videoId}">
            ${item.title}（${item.videoId}）
          </a>
          <br>
          <a href="/history/delete-one?index=${index}&pass=${encodeURIComponent(pass)}"
             style="color:red;">この履歴を削除</a>
        </li>`
    )
    .join("");

  html += "</ul><br><a href='/'>ホーム</a>";

  res.send(html);
});

// ------------------------------
// 履歴削除（全削除）
// ------------------------------
app.post("/history/delete", (req, res) => {
  const pass = req.body.pass;

  if (pass !== '1JaGdYufr5t&"') {
    return res.send("パスコードが違います");
  }

  if (fs.existsSync("history.json")) {
    fs.unlinkSync("history.json");
  }

  res.send(`
    <h2>履歴を削除しました</h2>
    <a href="/history?pass=${encodeURIComponent(pass)}">戻る</a>
  `);
});

// ------------------------------
// 履歴削除（個別）
// ------------------------------
app.get("/history/delete-one", (req, res) => {
  const pass = req.query.pass;
  const index = parseInt(req.query.index);

  if (pass !== '1JaGdYufr5t&"') {
    return res.send("パスコードが違います");
  }

  if (isNaN(index)) {
    return res.send("削除対象が不正です");
  }

  let data = [];
  if (fs.existsSync("history.json")) {
    data = JSON.parse(fs.readFileSync("history.json", "utf8"));
  }

  if (data[index]) {
    data.splice(index, 1);
    fs.writeFileSync("history.json", JSON.stringify(data, null, 2));
  }

  res.send(`
    <h2>履歴を削除しました</h2>
    <a href="/history?pass=${encodeURIComponent(pass)}">戻る</a>
  `);
});

// ------------------------------
app.listen(PORT, () => console.log("Server running"));

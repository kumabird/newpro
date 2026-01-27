import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_CODE = "157514";

app.use(express.urlencoded({ extended: true }));

// 🔐 認証ミドルウェア
app.use((req, res, next) => {
  const allowed = ["/login", "/auth"];
  if (allowed.includes(req.path)) return next();
  if (req.query.auth === "1") return next();
  res.redirect("/login");
});

// 🔑 認証ページ
app.get("/login", (req, res) => {
  res.send(`
    <h2>認証コードを入力してください</h2>
    <form method="POST" action="/auth">
      <input type="password" name="code" placeholder="認証コード">
      <button type="submit">送信</button>
    </form>
  `);
});

// 🔑 認証処理
app.post("/auth", (req, res) => {
  const code = req.body.code;
  if (code === AUTH_CODE) {
    res.redirect("/?auth=1");
  } else {
    res.send("<h3>認証コードが違います</h3><a href='/login'>戻る</a>");
  }
});

// 🏠 ホーム
app.get("/", (req, res) => {
  res.send(`
    <h2>YouTube Viewer（API不要）</h2>
    <form action="/search">
      <input type="hidden" name="auth" value="1">
      <input type="text" name="q" placeholder="検索ワードを入力" style="width:300px;">
      <button type="submit">検索</button>
    </form>
  `);
});

// 🔍 検索結果（最大51本・3列表示）
app.get("/search", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.send("検索ワードがありません");

  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
  const html = await fetch(url).then(r => r.text());

  const matches = [...html.matchAll(/"videoId":"(.*?)".*?"title":\{"runs":\[\{"text":"(.*?)"\}\]\}/gs)];
  const videos = matches.slice(0, 51).map(m => ({ id: m[1], title: m[2] }));

  let list = `<h2>検索結果: ${q}</h2><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;">`;
  list += videos.map(v => `
    <div>
      <a href="/watch?v=${v.id}&auth=1">
        <img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" style="width:100%; border-radius:8px;">
        <div style="margin-top:5px; font-weight:bold;">${v.title}</div>
      </a>
    </div>
  `).join("");
  list += "</div><br><a href='/?auth=1'>戻る</a>";

  res.send(list);
});

// ▶️ 動画再生（レスポンシブ対応）
app.get("/watch", (req, res) => {
  const id = req.query.v;
  if (!id) return res.send("動画IDがありません");

  res.send(`
    <h2>動画再生</h2>
    <div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; max-width:100%;">
      <iframe src="https://www.youtube.com/embed/${id}"
        style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;"
        allowfullscreen></iframe>
    </div>
    <br><br><a href='/?auth=1'>ホーム</a>
  `);
});

// 📺 チャンネル動画一覧（最大51本・3列表示）
app.get("/channel", async (req, res) => {
  const id = req.query.id;
  if (!id) return res.send("チャンネルIDがありません");

  const url = `https://www.youtube.com/channel/${id}/videos`;
  const html = await fetch(url).then(r => r.text());

  const matches = [...html.matchAll(/"videoId":"(.*?)".*?"title":\{"runs":\[\{"text":"(.*?)"\}\]\}/gs)];
  const videos = matches.slice(0, 51).map(m => ({ id: m[1], title: m[2] }));

  let list = `<h2>チャンネル動画一覧</h2><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;">`;
  list += videos.map(v => `
    <div>
      <a href="/watch?v=${v.id}&auth=1">
        <img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" style="width:100%; border-radius:8px;">
        <div style="margin-top:5px; font-weight:bold;">${v.title}</div>
      </a>
    </div>
  `).join("");
  list += "</div><br><a href='/?auth=1'>戻る</a>";

  res.send(list);
});

app.listen(PORT, () => console.log(`🌊 Server running at http://localhost:${PORT}`));


import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;
const YOUTUBE_API_KEY = "YOUR_API_KEY"; // ← ここに自分のAPIキーを入れてね！

app.use(express.urlencoded({ extended: true }));

// ホーム（検索フォーム）
app.get("/", (req, res) => {
  res.send(`
    <h2>YouTube Viewer</h2>
    <form action="/search">
      <input type="text" name="q" placeholder="検索ワードを入力" style="width:300px;">
      <button type="submit">検索</button>
    </form>
  `);
});

// 検索結果
app.get("/search", async (req, res) => {
  const q = req.query.q || "猫";

  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=9&q=${encodeURIComponent(q)}&key=${YOUTUBE_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    // エラーレスポンスの確認
    if (!data.items) {
      return res.send(`
        <h2>検索に失敗しました</h2>
        <p>エラー内容: ${data.error?.message || "不明なエラー"}</p>
        <a href="/">戻る</a>
      `);
    }

    const videos = data.items.map(item => ({
      id: item.id.videoId,
      title: item.snippet.title
    }));

    let html = `<h2>検索結果: ${q}</h2><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;">`;

    html += videos.map(v => `
      <div>
        <a href="/watch?v=${v.id}">
          <img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" style="width:100%; border-radius:8px;">
          <div style="margin-top:5px; font-weight:bold;">${v.title}</div>
        </a>
      </div>
    `).join("");

    html += "</div><br><a href='/'>戻る</a>";
    res.send(html);
  } catch (err) {
    res.send(`
      <h2>検索に失敗しました</h2>
      <p>エラー内容: ${err.message}</p>
      <a href="/">戻る</a>
    `);
  }
});

// 動画再生
app.get("/watch", (req, res) => {
  const id = req.query.v;
  if (!id) return res.send("動画IDがありません");

  res.send(`
    <h2>動画再生</h2>
    <iframe width="560" height="315"
      src="https://www.youtube.com/embed/${id}?autoplay=1"
      frameborder="0" allowfullscreen></iframe>
    <br><br>
    <a href="/">ホーム</a>
  `);
});

app.listen(PORT, () => {
  console.log(`🌿 YouTube Viewer 起動中：http://localhost:${PORT}`);
});

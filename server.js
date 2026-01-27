import express from "express";
import fetch from "node-fetch";

const app = express();
app.disable("x-powered-by");

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

// 検索結果（通常動画＋Shorts）
app.get("/search", async (req, res) => {
  const q = req.query.q || "猫";

  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=15&q=${encodeURIComponent(q)}&key=${YOUTUBE_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    const videos = data.items.map(item => ({
      id: item.id.videoId,
      title: item.snippet.title
    }));

    const normalVideos = videos.filter(v => !v.title.toLowerCase().includes("shorts"));
    const shortsVideos = videos.filter(v => v.title.toLowerCase().includes("shorts"));

    let html = `<h2>検索結果: ${q}</h2>`;

    if (normalVideos.length) {
      html += `<h3>通常の動画</h3><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;">`;
      html += normalVideos.map(v => `
        <div>
          <a href="/watch?v=${v.id}">
            <img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" style="width:100%; border-radius:8px;">
            <div style="margin-top:5px; font-weight:bold;">${v.title}</div>
          </a>
        </div>
      `).join("");
      html += "</div>";
    }

    if (shortsVideos.length) {
      html += `<h3>Shorts</h3><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;">`;
      html += shortsVideos.map(v => `
        <div>
          <a href="/shorts?v=${v.id}">
            <img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" style="width:100%; border-radius:8px;">
            <div style="margin-top:5px; font-weight:bold;">${v.title}</div>
          </a>
        </div>
      `).join("");
      html += "</div>";
    }

    html += `<br><a href="/">戻る</a>`;
    res.send(html);
  } catch (err) {
    res.send("検索に失敗しました: " + err.message);
  }
});

// 通常動画の再生
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

// Shorts 再生
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

app.listen(PORT, () => console.log("YouTube Viewer 起動中！"));

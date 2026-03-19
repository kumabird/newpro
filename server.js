app.post("/watch", async (req, res) => {
  const id = req.body.id;
  if (!id) return res.send("動画IDがありません");

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

  if (user) {
    await saveHistory(user, "watch", id, title);
  }

  // ★ 関連動画をスクレイピング
  let related = [];
  try {
    const pageUrl = `https://www.youtube.com/watch?v=${id}&hl=ja&gl=JP`;
    const html = await fetch(pageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "ja,en;q=0.9"
      }
    }).then(r => r.text());

    // ytInitialData を抽出
    const jsonMatch = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[1]);

      // secondaryResults の中に関連動画がある
      const secondary =
        data?.contents?.twoColumnWatchNextResults?.secondaryResults
             ?.secondaryResults?.results || [];

      for (const item of secondary) {
        const v = item.compactVideoRenderer;
        if (!v || !v.videoId) continue;

        related.push({
          id: v.videoId,
          title:
            v.title?.simpleText ||
            v.title?.runs?.map(r => r.text).join("") ||
            "No Title",
          thumb: v.thumbnail?.thumbnails?.slice(-1)[0]?.url || ""
        });

        if (related.length >= 20) break;
      }
    }
  } catch (e) {
    console.error("関連動画取得エラー:", e);
  }

  // ★ 関連動画サイドバーHTML
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
        .watch-player iframe {
          width: 100%;
          aspect-ratio: 16/9;
          border-radius: 12px;
          border: none;
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

          <!-- 左：プレイヤー -->
          <div class="watch-player">
            <h2 style="font-size:18px;margin-bottom:12px;">${title}</h2>
            <iframe src="${embedUrl}" allowfullscreen></iframe>
            <br><br>
            <a href="/">← ホームへ戻る</a>
          </div>

          <!-- 右：関連動画 -->
          <div class="watch-related">
            <h3>関連動画</h3>
            ${relatedHTML}
          </div>

        </div>
      </div>
      ${SIDEBAR_JS}
    </body>
    </html>
  `);
});

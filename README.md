# 敲木魚 🪘

多人即時敲木魚 Web App。看看全世界大家敲了幾下！

**[Live Demo →](https://thehcl.github.io/muyu)**

## 功能

- 敲擊木魚：動畫、音效、功德 +1
- 全站即時總功德（WebSocket 同步）
- 線上人數顯示
- 功德排行榜（每 5 秒更新）
- 他人敲擊時顯示即時動態
- 自動產生中文法號，可自訂暱稱
- 斷線自動重連

## 技術架構

```
前端：GitHub Pages（index.html，純 HTML/CSS/JS）
後端：Render（Node.js + ws WebSocket server）
WebSocket：wss://muyu-kmhq.onrender.com
```

## 部署

### 後端（Render）

1. 前往 [render.com](https://render.com)，用 GitHub 登入
2. **New → Web Service**，選此 repo
3. 設定：
   - Root Directory: `server`
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Instance Type: `Free`
4. Deploy，記下 Render 給的網址

### 前端（GitHub Pages）

1. 打開 `index.html`，將頂部的 `WS_URL` 填入 Render 網址：
   ```js
   const WS_URL = 'wss://muyu-kmhq.onrender.com';
   ```
2. Commit & push
3. Repo Settings → Pages → Source: main branch, root `/`

### 本地開發

```bash
cd server
npm install
npm start
# server 跑在 ws://localhost:3000
```

將 `index.html` 的 `WS_URL` 暫時改為 `ws://localhost:3000`，用瀏覽器直接開啟 `index.html` 測試。

## 注意事項

- Render 免費方案閒置 15 分鐘會睡眠，第一位訪客需等約 30 秒喚醒（頁面顯示「連線中...」）
- Server 每 30 秒發送 ping keepalive，避免連線被 proxy 切斷
- 後端資料為 in-memory，Render 重啟後計數歸零
- 免費方案不需綁信用卡

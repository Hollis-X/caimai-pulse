<picture align="center"><source media="(prefers-color-scheme: dark)" srcset="https://readme-typing-svg.herokuapp.com?font=SF+Pro+Display&size=28&duration=3500&pause=500&color=5B9BD5&center=true&vCenter=true&width=435&lines=财脉+Pulse+%F0%9F%93%88" /><source media="(prefers-color-scheme: light)" srcset="https://readme-typing-svg.herokuapp.com?font=SF+Pro+Display&size=28&duration=3500&pause=500&color=1C1C1E&center=true&vCenter=true&width=435&lines=财脉+Pulse+%F0%9F%93%88" /><img alt="财脉 Pulse" src="https://readme-typing-svg.herokuapp.com?font=SF+Pro+Display&size=28&duration=3500&pause=500&color=1C1C1E&center=true&vCenter=true&width=435&lines=%E8%B4%A2%E8%84%89+Pulse+%F0%9F%93%88" /></picture>

<p align="center"><b>实时财经快讯 · 资讯 · 行情 · 日历</b><br>移动端优先 · 金十 MCP 驱动 · 零前端框架</p>

<p align="center">
  <img src="https://img.shields.io/badge/python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/license-MIT%2BNC-lightgrey?style=for-the-badge" />
  <img src="https://img.shields.io/badge/frontend-Vanilla_JS%2BCSS-yellow?style=for-the-badge" />
  <img src="https://img.shields.io/badge/design-Apple×Material-007AFF?style=for-the-badge" />
</p>

---

## ⚡ 实时快讯推送

快讯每 **5 秒** 从金十 MCP 拉取，通过 **SSE** 实时推送至浏览器：

- 📍 你在页面顶部 → 新快讯自动淡入插入
- 📜 你已向下滚动 → 顶部悬浮提示「N 条新快讯」+ 提示音
- 🔄 断线 10 秒自动重连 · 页面隐藏自动断开
- 🔒 最大 10 连接 · 单连接 30 分钟超时

## 📰 资讯 · 📈 行情 · 📅 日历

| 模块 | 功能 |
|---|---|
| 📰 资讯 | 卡片列表 + 右滑详情页 + 关键词搜索 + Markdown 链接自动解析 |
| 📈 行情 | 8 品种实时报价 + SVG 蜡烛图（红涨绿跌，带上下影线） |
| 📅 日历 | 249 条财经事件 · 重要性星级标注 · 前值/预期/公布对比 |

## 🎨 前端组件

> 纯原生实现，零框架依赖

| 组件 | 实现 |
|---|---|
| 毛玻璃导航栏 | `backdrop-filter: saturate(180%) blur(20px)` |
| 药丸 Tab 切换 | 横向滚动 + sticky 吸顶 |
| 快讯时间轴 | 红点 + 实时淡入动画（`will-change`GPU加速） |
| 资讯卡片 | Material 阴影 + 点击右滑 Push 详情页 |
| SVG 蜡烛图 | 红涨绿跌 + 上下影线 + 网格 + 时间标 |
| 骨架屏 / 内联 Loading | 渐变 shimmer → 简洁圆环旋转 |
| iOS 底部导航 | 毛玻璃 + safe-area 适配 |
| PWA 安装引导 | 首次访问右下角弹出提示 |

## 🛡️ 安全

UA 校验 · Shared Key 鉴权 · IP 频率限制 · 异常脱敏 · 服务器指纹隐藏 · CORS 白名单

## 🍎 iOS 主屏幕

支持 PWA — `apple-touch-icon` + `manifest.json` + `standalone` 模式 + 自定义图标，首次访问弹出「添加到主屏幕」引导。

## 🚀 启动

```bash
docker compose up -d --build
```

## ⚙️ 环境变量

| 变量 | 说明 | 默认 |
|---|---|---|
| `JINTOKEN` | 金十 MCP Bearer Token | *必填* |
| `API_SECRET` | API 鉴权 key | `caimai-secret-change-me` |
| `RATE_LIMIT` | 每分钟请求上限 | `200` |
| `CORS_ORIGINS` | CORS 白名单 | `*` |
| `FLASK_DEBUG` | 设 `1` 开启调试 | `0` |

## 📂 目录

```
caimai-pulse/
├── run.py                 ← 入口
├── Dockerfile
├── docker-compose.yml
├── backend/
│   ├── config.py          ← 环境变量 / 路径
│   ├── auth.py            ← 鉴权 / UA / 限流
│   ├── mcp_client.py      ← 金十 SSE MCP 客户端
│   └── app.py             ← Flask API / SSE 端点
└── frontend/
    ├── index.html
    ├── manifest.json
    ├── css/style.css
    ├── js/app.js
    └── icons/
```

## 📡 API

> 所有接口需要 `?key=API_SECRET`

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/flash` | 快讯（`cursor`分页） |
| GET | `/api/flash/search?keyword=` | 搜索快讯 |
| GET | `/api/news` | 资讯（`cursor`分页） |
| GET | `/api/news/search?keyword=` | 搜索资讯 |
| GET | `/api/news/:id` | 资讯详情 |
| GET | `/api/quote/:code` | 品种实时行情 |
| GET | `/api/kline/:code?count=` | 品种K线 |
| GET | `/api/calendar` | 财经日历 |
| GET | `/api/stream/flash` | SSE 实时快讯流 |
| GET | `/api/health` | 健康检查 |

## 📊 支持品种

`XAUUSD` `XAGUSD` `USOIL` `UKOIL` `COPPER` `USDJPY` `EURUSD` `USDCNH`

## 📄 许可

MIT + Non-Commercial — 可自由使用、修改、分发，**禁止商业用途**。详见 [LICENSE](LICENSE)。
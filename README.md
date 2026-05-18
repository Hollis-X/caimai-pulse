<picture align="center"><source media="(prefers-color-scheme: dark)" srcset="https://readme-typing-svg.herokuapp.com?font=SF+Pro+Display&size=28&duration=3500&pause=500&color=5B9BD5&center=true&vCenter=true&width=435&lines=财脉+Pulse+%F0%9F%93%88" /><source media="(prefers-color-scheme: light)" srcset="https://readme-typing-svg.herokuapp.com?font=SF+Pro+Display&size=28&duration=3500&pause=500&color=1C1C1E&center=true&vCenter=true&width=435&lines=财脉+Pulse+%F0%9F%93%88" /><img alt="财脉 Pulse" src="https://readme-typing-svg.herokuapp.com?font=SF+Pro+Display&size=28&duration=3500&pause=500&color=1C1C1E&center=true&vCenter=true&width=435&lines=%E8%B4%A2%E8%84%89+Pulse+%F0%9F%93%88" /></picture>

<p align="center"><b>实时财经快讯 · 资讯 · 行情 · 日历</b><br>移动端优先 · 金十 MCP 驱动 · 零前端框架</p>

<p align="center">
  <img src="https://img.shields.io/badge/python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/license-MIT%2BNC-lightgrey?style=for-the-badge" />
</p>

---

## 这是什么

抓取金十数据的移动端财经面板，手机上打开就能看：

- ⚡ **快讯** — 实时推送，新消息自动弹出或悬浮提示
- 📰 **资讯** — 卡片列表 + 关键词搜索 + 详情阅读
- 📈 **行情** — 8 个品种报价 + 点开看蜡烛图
- 📅 **日历** — 财经事件重要性标注

前端 Apple × Material Design，后端 Flask + 金十 MCP，Docker 一条命令启动。

## 怎么用

手机浏览器或桌面打开页面，底部四个 tab 切换，顶部搜索。

## 前端

原生 HTML/CSS/JS，Apple × Material Design，无任何框架依赖。SSE 实时接收快讯推送，SVG 蜡烛图。

## 后端

| 能力 | 实现 |
|---|---|
| 数据源 | [金十 MCP](https://mcp.jin10.com/mcp)，Bearer Token 认证 |
| 通讯协议 | SSE（Server-Sent Events），浏览器长连接 |
| 快讯频率 | 每 5 秒拉一次，发现新快讯立即推送 |
| 鉴权 | Shared Key + UA 校验 + IP 限流 |
| 部署 | Docker 单容器，Gunicorn 2 worker × 8 线程 |

## 部署

```bash
docker run -d --name caimai-pulse -p 5000:5000 \
  -e JINTOKEN="sk-xxx" \
  -e API_SECRET="your-secret" \
  ghcr.io/hollis-x/caimai-pulse:latest
```

每次推送 main 分支自动构建到 [GHCR](https://github.com/Hollis-X/caimai-pulse/pkgs/container/caimai-pulse)。

## API

所有接口需要 `?key=API_SECRET`。

| 路径 | 数据 |
|---|---|
| `/api/flash` | 快讯列表 |
| `/api/news` | 资讯列表 |
| `/api/quote/XAUUSD` | 品种行情 |
| `/api/kline/XAUUSD` | 品种蜡烛图 |
| `/api/calendar` | 财经日历 |
| `/api/stream/flash` | 实时 SSE 流 |
| `/api/health` | 健康检查 |

## 项目结构

```text
backend/    → Flask API、MCP 客户端、鉴权
frontend/   → HTML、CSS、JS、图标、manifest
```

## 许可

MIT + Non-Commercial，禁止商业用途。
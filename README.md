# 财脉 Pulse

实时财经快讯 / 资讯 / 行情 / 日历 — 移动端优先，金十 MCP 驱动。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | 原生 HTML/CSS/JS，Apple × Material Design，零框架 |
| 后端 | Flask + Gunicorn，SSE 实时推送 |
| 数据 | [金十 MCP](https://mcp.jin10.com/mcp)，Bearer Token 认证 |
| 部署 | Docker，单容器，Python 3.11 |
| 安全 | UA 校验 / 频率限制 / Shared Key 鉴权 / 异常脱敏 |

## 目录结构

```
caimai-pulse/
├── run.py                    # 开发/生产共用入口
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── backend/
│   ├── config.py             # 环境变量 & 路径
│   ├── auth.py               # 鉴权 / UA / 限流
│   ├── mcp_client.py         # 金十 MCP SSE 客户端
│   └── app.py                # Flask API & SSE
└── frontend/
    ├── index.html
    ├── manifest.json
    ├── css/style.css
    ├── js/app.js
    └── icons/
        ├── xm.png
        └── xm.svg
```

## 启动

### Docker（推荐）

```bash
docker compose up -d --build
```

或：

```bash
docker run -d --name caimai-pulse -p 5000:5000 \
  -e JIN10_TOKEN="sk-xxx" \
  -e API_SECRET="your-secret" \
  --restart unless-stopped \
  caimai-pulse
```

### 本地开发

```bash
pip install -r requirements.txt
FLASK_DEBUG=1 python run.py
```

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `JIN10_TOKEN` | ✅ | 金十 MCP Bearer Token |
| `API_SECRET` | ❌ | API 鉴权 key（默认 `caimai-secret-change-me`） |
| `RATE_LIMIT` | ❌ | 每分钟请求上限（默认 200） |
| `CORS_ORIGINS` | ❌ | CORS 白名单（默认 `*`） |
| `FLASK_DEBUG` | ❌ | 设为 `1` 开启调试模式 |

## API 列表

所有 API 需要 `?key=API_SECRET` 鉴权。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/flash` | 快讯列表（支持 `cursor` 分页） |
| GET | `/api/flash/search?keyword=` | 搜索快讯 |
| GET | `/api/news` | 资讯列表（支持 `cursor` 分页） |
| GET | `/api/news/search?keyword=` | 搜索资讯 |
| GET | `/api/news/:id` | 资讯详情 |
| GET | `/api/quote/:code` | 品种实时行情 |
| GET | `/api/kline/:code?count=` | 品种K线 |
| GET | `/api/calendar` | 财经日历 |
| GET | `/api/health` | 健康检查（无需鉴权） |
| GET | `/api/stream/flash` | SSE 实时快讯推送 |

## SSE 实时推送

- 每 5 秒拉取金十最新快讯
- 建立基线后仅推送增量
- 心跳 25 秒（无新数据时）
- 断线 10 秒自动重连
- 页面隐藏自动断开

### SSE 保护

| 参数 | 值 |
|---|---|
| 最大在线连接 | 10 |
| 单连接最长时间 | 30 分钟 |
| 超过限制 | HTTP 503 |

## 功能特性

- ⚡ 快讯实时推送 + 智能插入（顶部自动淡入 / 滚离时悬浮提示 + 提示音）
- 📰 资讯卡片 + 右滑详情页 + 关键词搜索
- 📈 8 品种行情卡片 + SVG 蜡烛图
- 📅 财经日历重要性标注
- 🔒 UA 校验 / shared key 鉴权 / IP 限流
- 🍎 iOS PWA 主屏幕安装引导
- 📱 移动端优先，桌面端 430px 居中

## 支持品种

XAUUSD · XAGUSD · USOIL · UKOIL · COPPER · USDJPY · EURUSD · USDCNH

## 许可

MIT + Non-Commercial — 可自由使用、修改、分发，**禁止商业用途**。详见 [LICENSE](LICENSE)。
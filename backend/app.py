"""财脉 Pulse — Flask API & SSE 实时推送"""

import os
import json
import time
import threading
from flask import Flask, request, jsonify, send_from_directory, Response
from .config import BASE_DIR
from .mcp_client import get_mcp, init_mcp
from .auth import require_auth, require_light

app = Flask(__name__,
            static_folder=os.path.join(BASE_DIR, "frontend"),
            static_url_path="")

# SSE 连接保护
MAX_SSE_CLIENTS = 10
SSE_MAX_SECONDS = 30 * 60
SSE_HEARTBEAT_SECONDS = 25
SSE_CLIENTS = 0
SSE_LOCK = threading.Lock()


def ensure_mcp():
    """确保 MCP 已初始化"""
    mcp = get_mcp()
    if not mcp._initialized:
        init_mcp()
    return mcp


@app.after_request
def _security_headers(resp):
    resp.headers["Server"] = "web"
    origin = request.headers.get("Origin", "")
    allowed = os.environ.get("CORS_ORIGINS", "*")
    if allowed == "*" or origin in allowed.split(","):
        resp.headers["Access-Control-Allow-Origin"] = origin or "*"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
        resp.headers["Access-Control-Allow-Methods"] = "GET"
    return resp


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/api/health")
def api_health():
    mcp = ensure_mcp()
    return jsonify({"code": 0, "mcp_initialized": mcp._initialized,
                    "session_id": mcp.session_id})


# ══ 快讯 ══
@app.route("/api/flash")
@require_auth
def api_flash():
    mcp = ensure_mcp()
    try:
        data = mcp.list_flash(request.args.get("cursor"))
        return jsonify({"code": 0, "data": data})
    except Exception:
        return jsonify({"code": 500, "msg": "服务内部错误"}), 500


@app.route("/api/flash/search")
@require_auth
def api_flash_search():
    kw = request.args.get("keyword", "").strip()
    if not kw:
        return jsonify({"code": 400, "msg": "keyword 必填"}), 400
    try:
        return jsonify({"code": 0, "data": ensure_mcp().search_flash(kw)})
    except Exception:
        return jsonify({"code": 500, "msg": "服务内部错误"}), 500


# ══ 资讯 ══
@app.route("/api/news")
@require_auth
def api_news():
    try:
        data = ensure_mcp().list_news(request.args.get("cursor"))
        return jsonify({"code": 0, "data": data})
    except Exception:
        return jsonify({"code": 500, "msg": "服务内部错误"}), 500


@app.route("/api/news/search")
@require_auth
def api_news_search():
    kw = request.args.get("keyword", "").strip()
    if not kw:
        return jsonify({"code": 400, "msg": "keyword 必填"}), 400
    try:
        data = ensure_mcp().search_news(kw, request.args.get("cursor"))
        return jsonify({"code": 0, "data": data})
    except Exception:
        return jsonify({"code": 500, "msg": "服务内部错误"}), 500


@app.route("/api/news/<news_id>")
@require_auth
def api_news_detail(news_id):
    try:
        return jsonify({"code": 0, "data": ensure_mcp().get_news(news_id)})
    except Exception:
        return jsonify({"code": 500, "msg": "服务内部错误"}), 500


# ══ 行情 ══
@app.route("/api/quote/<code>")
@require_auth
def api_quote(code):
    try:
        return jsonify({"code": 0, "data": ensure_mcp().get_quote(code)})
    except Exception:
        return jsonify({"code": 500, "msg": "服务内部错误"}), 500


@app.route("/api/kline/<code>")
@require_auth
def api_kline(code):
    try:
        data = ensure_mcp().get_kline(code, request.args.get("count", 20, type=int))
        return jsonify({"code": 0, "data": data})
    except Exception:
        return jsonify({"code": 500, "msg": "服务内部错误"}), 500


# ══ 日历 & 品种 ══
@app.route("/api/calendar")
@require_auth
def api_calendar():
    try:
        return jsonify({"code": 0, "data": ensure_mcp().list_calendar()})
    except Exception:
        return jsonify({"code": 500, "msg": "服务内部错误"}), 500


@app.route("/api/codes")
@require_auth
def api_codes():
    try:
        return jsonify({"code": 0, "data": ensure_mcp().get_codes()})
    except Exception:
        return jsonify({"code": 500, "msg": "服务内部错误"}), 500


# ══ 快讯实时推送 SSE ══
@app.route("/api/stream/flash")
@require_light
def api_stream_flash():
    global SSE_CLIENTS
    with SSE_LOCK:
        if SSE_CLIENTS >= MAX_SSE_CLIENTS:
            return Response("SSE busy", status=503, mimetype="text/plain")
        SSE_CLIENTS += 1

    def generate():
        global SSE_CLIENTS
        start_ts = time.time()
        try:
            yield "retry: 10000\n"
            yield ": connected\n\n"
            mcp = ensure_mcp()
            seen = set()
            # 首次建立基线，不推送历史数据
            try:
                for item in mcp.list_flash().get("items", []):
                    url = item.get("url", "")
                    if url:
                        seen.add(url)
            except Exception:
                pass
            while True:
                if time.time() - start_ts > SSE_MAX_SECONDS:
                    yield "event: close\ndata: timeout\n\n"
                    break
                try:
                    fresh = []
                    for item in reversed(mcp.list_flash().get("items", [])):
                        url = item.get("url", "")
                        if url and url not in seen:
                            seen.add(url)
                            fresh.append(item)
                    if fresh:
                        yield f"data:{json.dumps(fresh, ensure_ascii=False)}\n\n"
                    elif time.time() - getattr(generate, "_last_ping", 0) >= SSE_HEARTBEAT_SECONDS:
                        yield ": ping\n\n"
                        generate._last_ping = time.time()
                except Exception:
                    yield ": error\n\n"
                time.sleep(5)
        finally:
            with SSE_LOCK:
                SSE_CLIENTS = max(0, SSE_CLIENTS - 1)

    return Response(generate(), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache",
                             "X-Accel-Buffering": "no",
                             "Connection": "keep-alive"})


def create_app():
    threading.Thread(target=init_mcp, daemon=True).start()
    return app
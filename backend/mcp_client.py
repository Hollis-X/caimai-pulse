"""金十 MCP 客户端 —— 标准 Streamable HTTP (SSE) 协议"""

import json
import time
import threading
import requests


class Jin10MCP:
    """金十数据 MCP 客户端（单例）"""

    def __init__(self, server_url, auth_token):
        self.server_url = server_url
        self.auth_token = auth_token
        self.session_id = None
        self._lock = threading.Lock()
        self._initialized = False
        self._tools_cache = None

    # ── 内部方法 ─────────────────────────────────

    def _headers(self):
        h = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.auth_token}",
        }
        if self.session_id:
            h["Mcp-Session-Id"] = self.session_id
        return h

    def _parse_sse(self, resp, timeout=20):
        """从 SSE 流中提取 JSON 响应"""
        resp.raise_for_status()
        sid = resp.headers.get("Mcp-Session-Id")
        if sid:
            self.session_id = sid

        ct = resp.headers.get("Content-Type", "")
        if "text/event-stream" not in ct:
            if not resp.text.strip():
                return {}
            return resp.json()

        # 读取完整响应体，按 SSE 规范解析
        body = resp.text
        last_json = None
        # SSE 事件由空行分隔；每个事件内 data 行合并
        for event_block in body.split("\n\n"):
            lines = event_block.split("\n")
            data_parts = []
            for line in lines:
                if line.startswith("data:"):
                    data_parts.append(line[5:].strip())
            if data_parts:
                data_str = "\n".join(data_parts)
                try:
                    last_json = json.loads(data_str)
                except json.JSONDecodeError:
                    pass
        return last_json or {}

    def _request(self, payload, timeout=20):
        """发送请求并解析 SSE 响应"""
        resp = requests.post(
            self.server_url,
            json=payload,
            headers=self._headers(),
            timeout=timeout,
            stream=True,
        )
        return self._parse_sse(resp, timeout)

    def _rpc(self, method, params=None, timeout=20):
        """封装 JSON-RPC 调用（需要响应）"""
        with self._lock:
            payload = {
                "jsonrpc": "2.0",
                "id": int(time.time() * 1000) % 1000000,
                "method": method,
                "params": params or {},
            }
            return self._request(payload, timeout)

    def _notify(self, method, params=None, timeout=8):
        """发送 JSON-RPC 通知（无需响应）"""
        payload = {
            "jsonrpc": "2.0",
            "method": method,
        }
        if params:
            payload["params"] = params
        # 通知不需要等待响应，用短超时
        try:
            self._request(payload, timeout)
        except Exception:
            pass

    # ── 初始化 ────────────────────────────────────

    def initialize(self):
        """MCP 握手：initialize -> notifications/initialized"""
        with self._lock:
            # 1. initialize（需要响应）
            resp = self._request({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-11-25",
                    "capabilities": {},
                    "clientInfo": {"name": "caimai-pulse", "version": "1.0.0"},
                },
            })
            # 2. initialized 通知（不需要响应）
            self._notify("notifications/initialized")
            self._initialized = True
            return resp

    # ── 工具列表 ──────────────────────────────────

    def list_tools(self):
        """获取可用工具列表"""
        resp = self._rpc("tools/list")
        tools = resp.get("result", {}).get("tools", [])
        self._tools_cache = tools
        return tools

    # ── 调用工具 ──────────────────────────────────

    @staticmethod
    def _fix_encoding(obj):
        """修复金十返回中文字段的双重 UTF-8 编码"""
        if isinstance(obj, str):
            try:
                fixed = obj.encode("latin-1").decode("utf-8")
                # 验证：修复后不应再含乱码特征
                if any(c in fixed for c in ["\u00e7", "\u00e8", "\u00e9", "\u00b0"]):
                    return obj
                return fixed
            except (UnicodeDecodeError, UnicodeEncodeError):
                return obj
        elif isinstance(obj, dict):
            return {k: Jin10MCP._fix_encoding(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [Jin10MCP._fix_encoding(i) for i in obj]
        return obj

    def call_tool(self, name, arguments=None):
        """调用 MCP 工具，返回 structuredContent.data"""
        resp = self._rpc("tools/call", {
            "name": name,
            "arguments": arguments or {},
        })
        result = resp.get("result", {})
        if result.get("isError"):
            raise Exception(f"MCP tool error: {result}")
        # 优先 structuredContent
        sc = result.get("structuredContent")
        if sc:
            data = sc.get("data", sc)
            return self._fix_encoding(data)
        # 回退 content（list_flash/list_news 返回此格式）
        content = result.get("content", [])
        for c in content:
            if c.get("type") == "text":
                text = c.get("text", "")
                try:
                    parsed = json.loads(text)
                    # 提取 data 字段
                    if isinstance(parsed, dict) and "data" in parsed:
                        return self._fix_encoding(parsed["data"])
                    return self._fix_encoding(parsed)
                except (json.JSONDecodeError, TypeError):
                    return self._fix_encoding(text)
        return self._fix_encoding(result)

    # ── 读取资源 ──────────────────────────────────

    def read_resource(self, uri):
        """读取 MCP 资源"""
        resp = self._rpc("resources/read", {"uri": uri})
        result = resp.get("result", {})
        contents = result.get("contents", [])
        if contents and len(contents) > 0:
            return contents[0].get("text", "")
        return result

    # ── 便捷方法 ──────────────────────────────────

    def get_quote(self, code):
        return self.call_tool("get_quote", {"code": code})

    def get_kline(self, code, count=20):
        return self.call_tool("get_kline", {"code": code, "count": count})

    def list_flash(self, cursor=None):
        args = {}
        if cursor:
            args["cursor"] = cursor
        return self.call_tool("list_flash", args)

    def search_flash(self, keyword):
        return self.call_tool("search_flash", {"keyword": keyword})

    def list_news(self, cursor=None):
        args = {}
        if cursor:
            args["cursor"] = cursor
        return self.call_tool("list_news", args)

    def search_news(self, keyword, cursor=None):
        args = {"keyword": keyword}
        if cursor:
            args["cursor"] = cursor
        return self.call_tool("search_news", args)

    def get_news(self, news_id):
        return self.call_tool("get_news", {"id": news_id})

    def list_calendar(self):
        return self.call_tool("list_calendar", {})

    def get_codes(self):
        text = self.read_resource("quote://codes")
        return text


# ── 全局单例 ─────────────────────────────────────

_mcp_instance = None

def get_mcp():
    global _mcp_instance
    if _mcp_instance is None:
        from .config import MCP_SERVER_URL, MCP_AUTH_TOKEN
        _mcp_instance = Jin10MCP(MCP_SERVER_URL, MCP_AUTH_TOKEN)
    return _mcp_instance

def init_mcp():
    mcp = get_mcp()
    try:
        mcp.initialize()
        mcp.list_tools()
        print("[MCP] 金十数据连接成功")
        return True
    except Exception as e:
        print(f"[MCP] 初始化失败: {e}")
        return False
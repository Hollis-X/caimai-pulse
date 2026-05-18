"""财脉 Pulse — 环境变量与路径"""

import os

# 金十 MCP 服务
MCP_SERVER_URL = os.environ.get("MCP_SERVER_URL", "https://mcp.jin10.com/mcp")
MCP_AUTH_TOKEN = os.environ.get("JIN10_TOKEN", "")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
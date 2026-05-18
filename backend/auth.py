"""财脉 Pulse — API 鉴权 / 频率限制 / UA 校验"""

import os
import time
import functools
from collections import defaultdict
from flask import request, jsonify

API_SECRET = os.environ.get("API_SECRET", "caimai-secret-change-me")
RATE_LIMIT_PER_MIN = int(os.environ.get("RATE_LIMIT", "200"))

_rate_store = defaultdict(list)


def _clean_rate():
    now = time.time()
    for key in list(_rate_store.keys()):
        _rate_store[key] = [t for t in _rate_store[key] if now - t < 60]
        if not _rate_store[key]:
            del _rate_store[key]


def check_rate_limit(key):
    _clean_rate()
    now = time.time()
    if len(_rate_store.get(key, [])) >= RATE_LIMIT_PER_MIN:
        return False
    _rate_store[key].append(now)
    return True


def check_browser():
    """拒绝 curl / wget / 脚本 UA"""
    ua = request.headers.get("User-Agent", "").lower()
    for b in ("curl", "wget", "python", "go-http", "libwww", "java/"):
        if b in ua:
            return False
    return True


def _rate_key():
    ip = request.headers.get("X-Forwarded-For", request.remote_addr) or "unknown"
    return ip.split(",")[0].strip()


def require_auth(f):
    """完整鉴权：UA → 限流 → shared key"""
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        if not check_browser():
            return jsonify({"code": 403, "msg": "Forbidden"}), 403
        if not check_rate_limit(_rate_key()):
            return jsonify({"code": 429, "msg": "请求过于频繁"}), 429
        if request.args.get("key") != API_SECRET:
            return jsonify({"code": 401, "msg": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return wrapper


def require_light(f):
    """轻量鉴权（SSE）：仅 UA + 限流，不验 key"""
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        if not check_browser():
            return jsonify({"code": 403, "msg": "Forbidden"}), 403
        if not check_rate_limit(_rate_key()):
            return jsonify({"code": 429, "msg": "请求过于频繁"}), 429
        return f(*args, **kwargs)
    return wrapper
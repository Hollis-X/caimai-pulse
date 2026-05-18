"""财脉 Pulse —— 启动入口"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.app import create_app

app = create_app()

if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    print("=" * 45)
    print("   财脉 Pulse")
    print(f"   模式: {'开发' if debug else '生产'}")
    print("=" * 45)
    app.run(host="0.0.0.0", port=5000, debug=debug, threaded=True)
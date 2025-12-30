#!/usr/bin/env python3
"""
启动脚本
"""
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=3001,
        reload=True,
        log_level="warning",
        access_log=False
    )


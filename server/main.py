import os

# 保证从任意工作目录启动时，.env / uploads 等相对路径都相对于 server/
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
from pathlib import Path
from starlette.types import ASGIApp, Scope, Receive, Send

from database import engine, Base
from routes import auth, users, documents, comments, tasks, notifications, templates, agora
from socket_handler import sio_app

# 创建上传目录
upload_dir = Path("uploads/avatars")
upload_dir.mkdir(parents=True, exist_ok=True)

# FastAPI 应用生命周期管理
@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(
    title="共墨 API",
    description="支持多人实时协作编辑文档的 API",
    version="1.0.0",
    lifespan=lifespan,
    redirect_slashes=False  
)

# CORS 跨域配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静态文件服务: 提供头像等文件访问
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# 异常处理: 捕获请求验证错误并记录详细信息
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    import json
    print("=" * 80)
    print(f"422 Validation Error on {request.method} {request.url}")
    print(f"Error details: {json.dumps(exc.errors(), indent=2, ensure_ascii=False)}")
    print(f"Request headers: {dict(request.headers)}")
    try:
        body = await request.body()
        if body:
            print(f"Request body: {body.decode('utf-8')}")
        else:
            print("Request body: (empty)")
    except Exception as e:
        print(f"Error reading request body: {e}")
    print("=" * 80)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors(), "body": str(exc.body) if hasattr(exc, 'body') else None}
    )

# API 路由注册
app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(users.router, prefix="/api/users", tags=["用户"])
app.include_router(documents.router, prefix="/api/documents", tags=["文档"])
app.include_router(comments.router, prefix="/api/comments", tags=["评论"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["任务"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["通知"])
app.include_router(templates.router, prefix="/api/templates", tags=["模板"])
app.include_router(agora.router, prefix="/api/agora", tags=["Agora"])

# 根路径: API 健康检查
@app.get("/")
async def root():
    return {"message": "共墨 API", "version": "1.0.0"}

# Socket.IO 集成: ASGI 包装器，用于同时支持 FastAPI 和 Socket.IO
class SocketIOWrapper:
    def __init__(self, app: ASGIApp, socketio_app: ASGIApp):
        self.app = app
        self.socketio_app = socketio_app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        path = scope.get("path", "")
        request_type = scope.get("type")
        
        # 判断请求类型: Socket.IO 请求（WebSocket 或 /socket.io 路径）
        if request_type == "websocket" or (request_type == "http" and path.startswith("/socket.io")):
            try:
                await self.socketio_app(scope, receive, send)
            except Exception as e:
                print(f"Socket.IO 处理错误: {e}")
                import traceback
                traceback.print_exc()
                if request_type == "http":
                    await send({
                        "type": "http.response.start",
                        "status": 500,
                        "headers": [[b"content-type", b"text/plain"]],
                    })
                    await send({
                        "type": "http.response.body",
                        "body": b"Socket.IO Error",
                    })
        else:
            # 普通 HTTP 请求由 FastAPI 处理
            await self.app(scope, receive, send)

# 包装应用: 将 FastAPI 和 Socket.IO 整合
fastapi_app = app
app = SocketIOWrapper(fastapi_app, sio_app)

# 启动服务器
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=3001,
        reload=True,
        log_level="warning",
        access_log=False
    )


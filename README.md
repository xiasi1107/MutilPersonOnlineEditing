多人在线编辑软件

支持多人实时协作编辑文档的 Web 应用程序，集成文档编辑、实时协作、评论批注、任务管理、视频会议等功能。

功能特性

用户管理：注册登录、权限管理、密码重置

文档管理：富文本编辑、自动保存、版本管理、模板系统、搜索分类

实时协作：多用户同时编辑、实时光标显示、评论批注、任务分配、视频会议

通知系统：实时通知、多种通知类型、通知跳转

技术栈

后端：Python 3.8+ / FastAPI / SQLAlchemy / MySQL / Socket.io / JWT / Agora.io

前端：React 18 / Material-UI / React Router / React Quill / Socket.io-client / Agora RTC SDK

快速开始

前置要求

Python 3.8+
Node.js 14+
MySQL 5.7+

安装步骤

1. 克隆项目
```bash
git clone <repository-url>
cd mutil_person_online_editing
```

2. 数据库配置

在 MySQL 中建库并导入脚本（**需手动执行**，启动后端不会自动跑 SQL）。库名需与下面 `.env` 里 `DB_NAME` 一致，示例为 `multi_person_editing`。

登录 MySQL 执行：

```sql
CREATE DATABASE IF NOT EXISTS multi_person_editing
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

在项目根目录执行导入（把 `root`、库名换成你的实际账号与库名）：

```bash
mysql -u root -p multi_person_editing < database/multi_person_editing.sql
```

在 `server/` 目录创建 `.env`（可复制 `server/.env.example`），数据库项与上面一致，并补充 JWT 等，例如：

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=multi_person_editing
DB_USER=root
DB_PASSWORD=你的MySQL密码
JWT_SECRET=请设置一个随机的密钥字符串（至少32个字符）
JWT_EXPIRES_IN=7d
PORT=3001
AGORA_APP_ID=你的Agora_App_ID
```

3. 安装依赖

后端：
```bash
cd server
python -m venv venv
Windows: venv\Scripts\activate
Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
```

前端：
```bash
cd client
npm install
```

4. 创建上传目录
```bash
mkdir -p server/uploads/avatars
```

5. 运行项目

终端 1 — 后端：`main.py` 启动时会将工作目录设为 `server/`，可在**仓库根目录**或 **`server` 目录**下执行，例如：

```bash
python server/main.py
```

若已 `cd server`，则执行 `python main.py`。也可在 `server` 目录下使用：`uvicorn main:app --reload --host 0.0.0.0 --port 3001`。

终端 2 — 前端：
```bash
cd client
npm start
```

6. 访问应用

前端：http://localhost:3000  
后端 API：http://localhost:3001  
API 文档：http://localhost:3001/docs  

首次使用：`database/multi_person_editing.sql` 主要为表结构；若库中尚无用户，请在前端注册页创建账号后再登录。

项目结构

```
mutil_person_online_editing/
├── server/              后端（FastAPI）
│   ├── routes/          API 路由
│   ├── models.py        数据模型
│   ├── schemas.py       数据验证
│   ├── database.py      数据库连接
│   ├── socket_handler.py WebSocket 处理
│   └── main.py          应用入口
├── client/              前端（React）
│   └── src/
│       ├── components/  组件
│       ├── pages/       页面
│       ├── hooks/       自定义 Hooks
│       └── contexts/    Context API
└── database/            数据库脚本
```

主要 API

认证：POST /api/auth/register、POST /api/auth/login、GET /api/auth/me

用户：GET /api/users、PUT /api/users/:id、POST /api/users/:id/avatar

文档：GET /api/documents、POST /api/documents、PUT /api/documents/:id、GET /api/documents/:id/versions

评论：POST /api/comments、GET /api/comments/document/:documentId

任务：POST /api/tasks/、GET /api/tasks/、PUT /api/tasks/:id

通知：GET /api/notifications、PUT /api/notifications/:id/read

模板：GET /api/templates、POST /api/templates

完整 API 文档：http://localhost:3001/docs

WebSocket 事件

客户端发送：user:join、document:edit、cursor:update、video_conference_joined

服务器发送：user:joined、document:updated、cursor:updated、video_user_joined

常见问题

数据库连接失败：检查 MySQL 服务、.env 配置、数据库权限

端口被占用：关闭占用 3000、3001 的进程，或同步修改 `server/main.py` 中 `uvicorn.run` 的端口与 `client` 开发代理中的端口

依赖安装失败：使用虚拟环境，或使用国内镜像源

Socket.io 连接失败：检查后端服务、防火墙、代理配置

视频会议无法连接：检查 AGORA_APP_ID 配置、浏览器权限、Windows 摄像头设置

注意事项

确保 MySQL 服务运行，端口 3000 和 3001 未被占用

生产环境请修改 JWT_SECRET 和数据库密码

确保 server/uploads 目录存在且有写权限

视频会议功能需要配置 Agora App ID

定期备份数据库

许可证

MIT License

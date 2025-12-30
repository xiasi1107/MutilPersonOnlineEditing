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

2. 初始化数据库
```bash
mysql -u root -p < database/multi_person_editing.sql
```

3. 配置环境变量

在 server/ 目录创建 .env 文件：
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

4. 安装依赖

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

5. 创建上传目录
```bash
mkdir -p server/uploads/avatars
```

6. 运行项目

终端1 - 后端：
```bash
cd server
python main.py
或: uvicorn main:app --reload --host 0.0.0.0 --port 3001
```

终端2 - 前端：
```bash
cd client
npm start
```

7. 访问应用

前端：http://localhost:3000
后端 API：http://localhost:3001
API 文档：http://localhost:3001/docs

默认账户：admin / admin123（生产环境请修改密码）

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

端口被占用：修改 server/.env 中的 PORT 或关闭占用进程

依赖安装失败：使用虚拟环境，或使用国内镜像源

Socket.io 连接失败：检查后端服务、防火墙、代理配置

视频会议无法连接：检查 AGORA_APP_ID 配置、浏览器权限、Windows 摄像头设置

生产环境部署

1. 构建前端
```bash
cd client
npm run build
```

2. 运行后端
```bash
pip install gunicorn
cd server
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:3001
```

3. 配置 Nginx（可选）
```nginx
server {
    listen 80;
    server_name your-domain.com;
    location / {
        root /path/to/client/build;
        try_files $uri $uri/ /index.html;
    }
    location /api {
        proxy_pass http://localhost:3001;
    }
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

注意事项

确保 MySQL 服务运行，端口 3000 和 3001 未被占用

生产环境请修改 JWT_SECRET 和数据库密码

确保 server/uploads 目录存在且有写权限

视频会议功能需要配置 Agora App ID

定期备份数据库

许可证

MIT License

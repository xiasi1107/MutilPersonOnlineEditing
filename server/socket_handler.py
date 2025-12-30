from socketio import AsyncServer, ASGIApp
import os
from dotenv import load_dotenv
from database import SessionLocal
from models import Document, DocumentPermission, User, PermissionType
from utils import decode_access_token
from datetime import datetime

load_dotenv()

# 创建 Socket.IO 服务器
sio = AsyncServer(
    cors_allowed_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    async_mode='asgi'
)

# 存储在线用户和文档编辑者
online_users = {}  # userId -> socket_id
document_editors = {}  # documentId -> set of userIds
video_conference_participants = {}  # documentId -> set of userIds
user_sessions = {}  # sid -> user_id

# Socket.IO 事件处理
@sio.event
async def connect(sid, environ, auth=None):
    """用户连接"""
    try:
        token = None
        
        if auth and isinstance(auth, dict):
            token = auth.get('token')
        
        if not token:
            query_string = environ.get('QUERY_STRING', '')
            if query_string:
                import urllib.parse
                params = urllib.parse.parse_qs(query_string)
                token_list = params.get('token', [])
                if token_list:
                    token = token_list[0]
        
        if not token:
            for key in environ.keys():
                if key.startswith('HTTP_') and 'AUTHORIZATION' in key.upper():
                    auth_header = environ[key]
                    if auth_header.startswith('Bearer '):
                        token = auth_header[7:]
                        break
        
        if not token:
            return False
        
        payload = decode_access_token(token)
        if not payload:
            return False
        
        user_id = payload.get('userId')
        if not user_id:
            return False
        
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user or user.status != "active":
                return False
            
            online_users[user_id] = sid
            user_sessions[sid] = user_id
            await sio.save_session(sid, {'user_id': user_id})
            return True
        finally:
            db.close()
    except Exception as e:
        import traceback
        print(f"连接错误: {e}")
        traceback.print_exc()
        return False

@sio.on('disconnect')
async def disconnect(sid):
    """用户断开连接"""
    user_id = user_sessions.get(sid)
    if user_id:
        online_users.pop(user_id, None)
        # 从所有文档编辑者中移除
        for doc_id, editors in document_editors.items():
            editors.discard(user_id)
    user_sessions.pop(sid, None)

@sio.on('user_join')
async def user_join(sid, data):
    """用户加入文档编辑"""
    session = await sio.get_session(sid)
    user_id = session.get('user_id')
    document_id = data.get('documentId')
    
    if not user_id or not document_id:
        return
    
    # 检查权限
    db = SessionLocal()
    try:
        permission = db.query(DocumentPermission).filter(
            DocumentPermission.documentId == document_id,
            DocumentPermission.userId == user_id
        ).first()
        
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            return
        
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return
        
        # 检查是否有权限
        if not document.isPublic and not permission:
            if document.creatorId != user_id and user.role != 'admin':
                return
    finally:
        db.close()
    
    # 加入文档房间
    room = f"document:{document_id}"
    await sio.enter_room(sid, room)
    
    # 添加到编辑者列表
    if document_id not in document_editors:
        document_editors[document_id] = set()
    document_editors[document_id].add(user_id)
    
    # 通知所有用户，发送当前所有编辑者信息
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        # 获取所有编辑者的用户信息
        all_editors_info = []
        for editor_id in document_editors[document_id]:
            editor_user = db.query(User).filter(User.id == editor_id).first()
            if editor_user:
                all_editors_info.append({
                    'id': editor_user.id,
                    'username': editor_user.username,
                    'nickname': editor_user.nickname,
                    'avatar': editor_user.avatar
                })
        
        # 发送给所有用户（包括发送者），确保每个人都能看到所有编辑者
        await sio.emit('user_joined', {
            'userId': user_id,
            'user': {
                'id': user.id,
                'username': user.username,
                'nickname': user.nickname,
                'avatar': user.avatar
            },
            'editors': all_editors_info  # 发送所有编辑者的完整信息
        }, room=room)  # 移除 skip_sid，让所有用户（包括发送者）都能收到
    finally:
        db.close()

@sio.on('user_leave')
async def user_leave(sid, data):
    """用户离开文档编辑"""
    session = await sio.get_session(sid)
    user_id = session.get('user_id')
    document_id = data.get('documentId')
    
    if document_id and document_id in document_editors:
        document_editors[document_id].discard(user_id)
        room = f"document:{document_id}"
        await sio.emit('user_left', {
            'userId': user_id,
            'editors': list(document_editors[document_id])
        }, room=room, skip_sid=sid)

@sio.on('document_edit')
async def document_edit(sid, data):
    """文档编辑"""
    session = await sio.get_session(sid)
    user_id = session.get('user_id')
    document_id = data.get('documentId')
    content = data.get('content')
    
    if not user_id or not document_id:
        return
    
    # 检查权限并更新文档
    db = SessionLocal()
    try:
        permission = db.query(DocumentPermission).filter(
            DocumentPermission.documentId == document_id,
            DocumentPermission.userId == user_id
        ).first()
        
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            return
        
        # 检查是否有编辑权限
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            await sio.emit('error', {'message': '用户不存在'}, room=sid)
            return
        
        has_edit_permission = False
        if permission and permission.permission in [PermissionType.write, PermissionType.admin]:
            has_edit_permission = True
        elif user.role == 'admin':
            has_edit_permission = True  # 系统管理员可以编辑所有文档
        elif document.creatorId == user_id:
            has_edit_permission = True  # 创建者可以编辑自己的文档
        
        if not has_edit_permission:
            await sio.emit('error', {'message': '无权编辑该文档（只读权限）'}, room=sid)
            return
        
        # 更新文档
        document.content = content
        document.lastEditedBy = user_id
        document.lastEditedAt = datetime.utcnow()
        db.commit()
    except Exception as e:
        print(f"文档更新错误: {e}")
        db.rollback()
    finally:
        db.close()
    
    # 广播给其他用户
    room = f"document:{document_id}"
    await sio.emit('document_updated', {
        'documentId': document_id,
        'content': content,
        'userId': user_id,
        'timestamp': datetime.utcnow().isoformat()
    }, room=room, skip_sid=sid)

@sio.on('cursor_update')
async def cursor_update(sid, data):
    """光标位置更新"""
    session = await sio.get_session(sid)
    user_id = session.get('user_id')
    document_id = data.get('documentId')
    
    if user_id and document_id:
        room = f"document:{document_id}"
        await sio.emit('cursor_updated', {
            'userId': user_id,
            'position': data.get('position'),
            'selection': data.get('selection')
        }, room=room)  # 移除 skip_sid，让所有用户（包括发送者）都能收到

@sio.on('title_update')
async def title_update(sid, data):
    """标题更新"""
    session = await sio.get_session(sid)
    user_id = session.get('user_id')
    document_id = data.get('documentId')
    title = data.get('title')
    
    if not user_id or not document_id:
        return
    
    # 检查权限并更新文档标题
    db = SessionLocal()
    try:
        permission = db.query(DocumentPermission).filter(
            DocumentPermission.documentId == document_id,
            DocumentPermission.userId == user_id
        ).first()
        
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            return
        
        # 检查是否有编辑权限
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            await sio.emit('error', {'message': '用户不存在'}, room=sid)
            return
        
        has_edit_permission = False
        if permission and permission.permission in [PermissionType.write, PermissionType.admin]:
            has_edit_permission = True
        elif user.role == 'admin':
            has_edit_permission = True  # 系统管理员可以编辑所有文档
        elif document.creatorId == user_id:
            has_edit_permission = True  # 创建者可以编辑自己的文档
        
        if not has_edit_permission:
            await sio.emit('error', {'message': '无权编辑该文档（只读权限）'}, room=sid)
            return
        
        # 更新文档标题
        document.title = title
        document.lastEditedBy = user_id
        document.lastEditedAt = datetime.utcnow()
        db.commit()
    except Exception as e:
        print(f"标题更新错误: {e}")
        db.rollback()
    finally:
        db.close()
    
    # 广播给所有用户（包括发送者）
    room = f"document:{document_id}"
    await sio.emit('title_updated', {
        'documentId': document_id,
        'title': title,
        'userId': user_id,
        'timestamp': datetime.utcnow().isoformat()
    }, room=room)

# 视频会议相关事件
@sio.on('video_conference_joined')
async def video_conference_joined(sid, data):
    """用户加入视频会议"""
    session = await sio.get_session(sid)
    user_id = session.get('user_id')
    document_id = data.get('documentId')
    
    if user_id and document_id:
        # 添加到参与者列表
        if document_id not in video_conference_participants:
            video_conference_participants[document_id] = set()
        video_conference_participants[document_id].add(user_id)
        
        room = f"document:{document_id}"
        
        # 获取用户信息
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                # 获取所有参与者的用户信息
                all_participants_info = []
                for participant_id in video_conference_participants[document_id]:
                    participant_user = db.query(User).filter(User.id == participant_id).first()
                    if participant_user:
                        all_participants_info.append({
                            'id': participant_user.id,
                            'username': participant_user.username,
                            'nickname': participant_user.nickname,
                            'avatar': participant_user.avatar
                        })
                
                # 立即通知所有用户（包括发送者），发送完整的参与者列表
                await sio.emit('video_conference_user_joined', {
                    'userId': user_id,
                    'user': {
                        'id': user.id,
                        'username': user.username,
                        'nickname': user.nickname,
                        'avatar': user.avatar
                    },
                    'channelName': data.get('channelName'),
                    'uid': data.get('uid'),
                    'participants': all_participants_info  # 发送所有参与者的完整信息
                }, room=room)  # 移除 skip_sid，让所有用户（包括发送者）都能收到
        finally:
            db.close()

@sio.on('video_conference_left')
async def video_conference_left(sid, data):
    """用户离开视频会议"""
    session = await sio.get_session(sid)
    user_id = session.get('user_id')
    document_id = data.get('documentId')
    
    if user_id and document_id:
        # 从参与者列表移除
        if document_id in video_conference_participants:
            video_conference_participants[document_id].discard(user_id)
            # 如果没有人了，清理这个文档的参与者列表
            if not video_conference_participants[document_id]:
                del video_conference_participants[document_id]
        
        room = f"document:{document_id}"
        
        # 获取剩余参与者的用户信息
        db = SessionLocal()
        try:
            remaining_participants_info = []
            if document_id in video_conference_participants:
                for participant_id in video_conference_participants[document_id]:
                    participant_user = db.query(User).filter(User.id == participant_id).first()
                    if participant_user:
                        remaining_participants_info.append({
                            'id': participant_user.id,
                            'username': participant_user.username,
                            'nickname': participant_user.nickname,
                            'avatar': participant_user.avatar
                        })
            
            await sio.emit('video_conference_user_left', {
                'userId': user_id,
                'participants': remaining_participants_info  # 发送剩余参与者的完整信息
            }, room=room)  # 移除 skip_sid，让所有用户都能收到
        finally:
            db.close()

# 创建 ASGI 应用
# 注意：socketio_path 应该与 mount 的路径匹配，但不需要包含在路径中
sio_app = ASGIApp(sio)

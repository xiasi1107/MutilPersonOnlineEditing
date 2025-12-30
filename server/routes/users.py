from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
from database import get_db
from models import User, OperationLog, UserRole, UserStatus, UserTag, UserFolder
from schemas import UserResponse, UserUpdate, UserTagCreate, UserTagUpdate, UserTagResponse, UserFolderCreate, UserFolderUpdate, UserFolderResponse
from middleware import get_current_user, require_role
from utils import get_password_hash, verify_password
from datetime import datetime
from pathlib import Path
import shutil

router = APIRouter()

@router.get("/list", response_model=list[UserResponse])
async def get_users(
    page: int = 1,
    limit: int = 10,
    role: Optional[str] = Query(None, description="角色筛选: admin, normal (普通用户)"),
    status_filter: Optional[UserStatus] = None,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db)
):
    """获取用户列表（管理员）"""
    query = db.query(User)
    
    # 角色筛选：normal 表示所有非管理员用户（editor 和 viewer）
    if role:
        if role == "normal":
            # 筛选所有非管理员用户
            query = query.filter(User.role != UserRole.admin)
        elif role == "admin":
            query = query.filter(User.role == UserRole.admin)
        else:
            # 如果传入的是其他值，尝试作为 UserRole 枚举值处理
            try:
                role_enum = UserRole(role)
                query = query.filter(User.role == role_enum)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"无效的角色值: {role}")
    if status_filter:
        query = query.filter(User.status == status_filter)
    
    users = query.offset((page - 1) * limit).limit(limit).all()
    return [UserResponse.model_validate(user) for user in users]

@router.get("/search", response_model=list[UserResponse])
async def search_users(
    q: str,
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """搜索用户（用于分享文档）"""
    # 允许空关键字：返回活跃用户列表（前端会二次过滤/去重）
    if not q or len(q.strip()) < 1:
        users = db.query(User).filter(User.status == UserStatus.active).limit(limit).all()
        return [UserResponse.model_validate(user) for user in users]
    
    users = db.query(User).filter(
        User.status == UserStatus.active,
        or_(
            User.username.like(f"%{q}%"),
            User.email.like(f"%{q}%"),
            User.nickname.like(f"%{q}%"),
            User.phone.like(f"%{q}%")
        )
    ).limit(limit).all()
    
    return [UserResponse.model_validate(user) for user in users]

# ========== 用户标签管理 ==========
# 注意：这些路由必须在 /{user_id} 路由之前定义，否则会被误匹配

@router.get("/tags")
async def get_user_tags(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取当前用户的所有标签"""
    try:
        tags = db.query(UserTag).filter(UserTag.userId == current_user.id).order_by(UserTag.name).all()
        # 直接返回字典列表，避免 Pydantic 响应验证问题
        result = []
        for tag in tags:
            tag_dict = {
                "id": tag.id,
                "userId": tag.userId,
                "name": tag.name,
                "createdAt": tag.createdAt.isoformat() if hasattr(tag.createdAt, 'isoformat') else str(tag.createdAt),
                "updatedAt": tag.updatedAt.isoformat() if hasattr(tag.updatedAt, 'isoformat') else str(tag.updatedAt)
            }
            result.append(tag_dict)
        # 直接返回列表，让 FastAPI 自动序列化为 JSON
        return result
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error fetching tags: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"获取标签列表失败: {str(e)}")

@router.post("/tags", response_model=UserTagResponse, status_code=status.HTTP_201_CREATED)
async def create_user_tag(
    tag_data: UserTagCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """创建用户标签"""
    # 检查标签名称是否已存在
    existing = db.query(UserTag).filter(
        UserTag.userId == current_user.id,
        UserTag.name == tag_data.name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="标签名称已存在")
    
    tag = UserTag(
        userId=current_user.id,
        name=tag_data.name
    )
    db.add(tag)
    db.commit()
    db.refresh(tag)
    
    return UserTagResponse.model_validate(tag)

@router.put("/tags/{tag_id}", response_model=UserTagResponse)
async def update_user_tag(
    tag_id: int,
    tag_data: UserTagUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新用户标签"""
    tag = db.query(UserTag).filter(
        UserTag.id == tag_id,
        UserTag.userId == current_user.id
    ).first()
    if not tag:
        raise HTTPException(status_code=404, detail="标签不存在")
    
    if tag_data.name is not None:
        # 检查新名称是否与其他标签冲突
        existing = db.query(UserTag).filter(
            UserTag.userId == current_user.id,
            UserTag.name == tag_data.name,
            UserTag.id != tag_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="标签名称已存在")
        tag.name = tag_data.name
    
    tag.updatedAt = datetime.now()
    db.commit()
    db.refresh(tag)
    
    return UserTagResponse.model_validate(tag)

@router.delete("/tags/{tag_id}")
async def delete_user_tag(
    tag_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除用户标签"""
    tag = db.query(UserTag).filter(
        UserTag.id == tag_id,
        UserTag.userId == current_user.id
    ).first()
    if not tag:
        raise HTTPException(status_code=404, detail="标签不存在")
    
    db.delete(tag)
    db.commit()
    
    return {"message": "标签删除成功"}

# ========== 用户文件夹管理 ==========

@router.get("/folders")
async def get_user_folders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取当前用户的所有文件夹"""
    print("=" * 80)
    print("get_user_folders called")
    print(f"User: {current_user.id if current_user else 'None'}")
    try:
        folders = db.query(UserFolder).filter(UserFolder.userId == current_user.id).order_by(UserFolder.name).all()
        print(f"Found {len(folders)} folders for user {current_user.id}")
        # 直接返回字典列表，避免 Pydantic 响应验证问题
        result = []
        for folder in folders:
            try:
                folder_dict = {
                    "id": folder.id,
                    "userId": folder.userId,
                    "name": folder.name,
                    "parentId": folder.parentId,
                    "createdAt": folder.createdAt.isoformat() if hasattr(folder.createdAt, 'isoformat') else str(folder.createdAt),
                    "updatedAt": folder.updatedAt.isoformat() if hasattr(folder.updatedAt, 'isoformat') else str(folder.updatedAt)
                }
                result.append(folder_dict)
            except Exception as e:
                print(f"Error processing folder {folder.id}: {e}")
                import traceback
                print(traceback.format_exc())
        print(f"Successfully built {len(result)} folder dicts")
        print("=" * 80)
        # 直接返回列表，让 FastAPI 自动序列化为 JSON
        return result
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error fetching folders: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"获取文件夹列表失败: {str(e)}")

@router.post("/folders", response_model=UserFolderResponse, status_code=status.HTTP_201_CREATED)
async def create_user_folder(
    folder_data: UserFolderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """创建用户文件夹"""
    # 检查文件夹名称是否在同一层级已存在
    existing = db.query(UserFolder).filter(
        UserFolder.userId == current_user.id,
        UserFolder.name == folder_data.name,
        UserFolder.parentId == folder_data.parentId
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="文件夹名称已存在")
    
    # 如果指定了父文件夹，验证父文件夹存在且属于当前用户
    if folder_data.parentId:
        parent = db.query(UserFolder).filter(
            UserFolder.id == folder_data.parentId,
            UserFolder.userId == current_user.id
        ).first()
        if not parent:
            raise HTTPException(status_code=404, detail="父文件夹不存在")
    
    folder = UserFolder(
        userId=current_user.id,
        name=folder_data.name,
        parentId=folder_data.parentId
    )
    db.add(folder)
    db.commit()
    db.refresh(folder)
    
    return UserFolderResponse.model_validate(folder)

@router.put("/folders/{folder_id}", response_model=UserFolderResponse)
async def update_user_folder(
    folder_id: int,
    folder_data: UserFolderUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新用户文件夹"""
    folder = db.query(UserFolder).filter(
        UserFolder.id == folder_id,
        UserFolder.userId == current_user.id
    ).first()
    if not folder:
        raise HTTPException(status_code=404, detail="文件夹不存在")
    
    if folder_data.name is not None:
        # 检查新名称是否在同一层级与其他文件夹冲突
        existing = db.query(UserFolder).filter(
            UserFolder.userId == current_user.id,
            UserFolder.name == folder_data.name,
            UserFolder.parentId == folder_data.parentId if folder_data.parentId is not None else folder.parentId,
            UserFolder.id != folder_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="文件夹名称已存在")
        folder.name = folder_data.name
    
    if folder_data.parentId is not None:
        # 验证父文件夹存在且属于当前用户
        if folder_data.parentId != folder.parentId:
            if folder_data.parentId == folder.id:
                raise HTTPException(status_code=400, detail="不能将文件夹设置为自己的子文件夹")
            parent = db.query(UserFolder).filter(
                UserFolder.id == folder_data.parentId,
                UserFolder.userId == current_user.id
            ).first()
            if not parent:
                raise HTTPException(status_code=404, detail="父文件夹不存在")
        folder.parentId = folder_data.parentId
    
    folder.updatedAt = datetime.now()
    db.commit()
    db.refresh(folder)
    
    return UserFolderResponse.model_validate(folder)

@router.delete("/folders/{folder_id}")
async def delete_user_folder(
    folder_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除用户文件夹"""
    folder = db.query(UserFolder).filter(
        UserFolder.id == folder_id,
        UserFolder.userId == current_user.id
    ).first()
    if not folder:
        raise HTTPException(status_code=404, detail="文件夹不存在")
    
    db.delete(folder)
    db.commit()
    
    return {"message": "文件夹删除成功"}

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取用户信息"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return UserResponse.model_validate(user)

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新用户信息"""
    if user_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="无权修改该用户信息")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    update_data = user_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    
    # 记录操作日志
    log = OperationLog(
        userId=current_user.id,
        action="update",
        description=f"更新用户信息: {user.username}"
    )
    db.add(log)
    db.commit()
    
    return UserResponse.model_validate(user)

@router.post("/{user_id}/avatar")
async def upload_avatar(
    user_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """上传头像"""
    if user_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="无权修改该用户头像")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    # 检查文件类型
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="只允许上传图片文件")
    
    # 保存文件
    upload_dir = Path("uploads/avatars")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    file_extension = Path(file.filename).suffix
    filename = f"avatar-{user_id}-{int(datetime.now().timestamp())}{file_extension}"
    file_path = upload_dir / filename
    
    # 删除旧头像
    if user.avatar:
        old_path = Path(user.avatar.lstrip("/"))
        if old_path.exists():
            old_path.unlink()
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    user.avatar = f"/uploads/avatars/{filename}"
    db.commit()
    
    return {"message": "头像上传成功", "avatar": user.avatar}

@router.put("/{user_id}/password")
async def change_password(
    user_id: int,
    old_password: Optional[str] = Form(None),
    new_password: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """修改密码"""
    if user_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="无权修改该用户密码")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    if not new_password:
        raise HTTPException(status_code=400, detail="请提供新密码")
    
    # 管理员可以跳过旧密码验证
    if current_user.role != UserRole.admin and old_password:
        from utils import verify_password
        if not verify_password(old_password, user.password):
            raise HTTPException(status_code=401, detail="旧密码错误")
    
    user.password = get_password_hash(new_password)
    db.commit()
    
    return {"message": "密码修改成功"}

@router.put("/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: int,
    role: UserRole,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db)
):
    """更新用户角色（管理员）"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    user.role = role
    db.commit()
    db.refresh(user)
    
    return UserResponse.model_validate(user)


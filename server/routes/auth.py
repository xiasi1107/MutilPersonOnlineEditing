from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from database import get_db
from models import User, OperationLog, PasswordResetToken
from schemas import UserCreate, UserLogin, UserResponse, TokenResponse, ForgotPasswordRequest, ForgotPasswordResponse, ResetPasswordRequest, ResetPasswordResponse
from utils import get_password_hash, verify_password, create_access_token
from middleware import get_current_user
from datetime import datetime, timedelta
import secrets

router = APIRouter()

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """用户注册"""
    # 构建查询条件
    conditions = [
        User.username == user_data.username,
        User.email == user_data.email
    ]
    
    # 如果提供了手机号，检查是否已存在
    if user_data.phone:
        conditions.append(User.phone == user_data.phone)
    
    # 检查用户名和邮箱是否已存在
    existing_user = db.query(User).filter(or_(*conditions)).first()
    
    if existing_user:
        # 提供更详细的错误信息
        if existing_user.username == user_data.username:
            detail = "用户名已存在"
        elif existing_user.email == user_data.email:
            detail = "邮箱已存在"
        elif user_data.phone and existing_user.phone == user_data.phone:
            detail = "手机号已存在"
        else:
            detail = "用户名、邮箱或手机号已存在"
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )
    
    # 创建新用户（默认角色为普通用户 viewer）
    hashed_password = get_password_hash(user_data.password)
    from models import UserRole
    db_user = User(
        username=user_data.username,
        email=user_data.email,
        phone=user_data.phone,
        password=hashed_password,
        nickname=user_data.nickname or user_data.username,
        role=UserRole.viewer  # 默认角色为普通用户
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # 记录操作日志
    log = OperationLog(
        userId=db_user.id,
        action="create",
        description="用户注册"
    )
    db.add(log)
    db.commit()
    
    # 生成 token
    token = create_access_token(data={"userId": db_user.id})
    
    return TokenResponse(
        token=token,
        user=UserResponse.model_validate(db_user)
    )

@router.post("/login", response_model=TokenResponse)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """用户登录"""
    # 查找用户（支持用户名、邮箱、手机号登录）
    user = db.query(User).filter(
        or_(
            User.username == login_data.username,
            User.email == login_data.username,
            User.phone == login_data.username
        )
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误"
        )
    
    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="账户已被禁用"
        )
    
    if not verify_password(login_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误"
        )
    
    # 更新最后登录时间
    user.lastLoginAt = datetime.utcnow()
    db.commit()
    
    # 记录操作日志
    log = OperationLog(
        userId=user.id,
        action="read",
        description="用户登录"
    )
    db.add(log)
    db.commit()
    
    # 生成 token
    token = create_access_token(data={"userId": user.id})
    
    return TokenResponse(
        token=token,
        user=UserResponse.model_validate(user)
    )

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """获取当前用户信息"""
    return UserResponse.model_validate(current_user)

@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """忘记密码 - 生成重置令牌"""
    # 查找用户
    user = db.query(User).filter(User.email == request.email).first()
    
    # 为了安全，即使用户不存在也返回成功消息（防止邮箱枚举攻击）
    if not user:
        return ForgotPasswordResponse(
            message="如果该邮箱存在，重置链接已发送到您的邮箱"
        )
    
    if user.status != "active":
        return ForgotPasswordResponse(
            message="如果该邮箱存在，重置链接已发送到您的邮箱"
        )
    
    # 生成重置令牌
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=1)  # 1小时后过期
    
    # 使该用户之前的重置令牌失效
    db.query(PasswordResetToken).filter(
        PasswordResetToken.userId == user.id,
        PasswordResetToken.used == False
    ).update({"used": True})
    
    # 创建新的重置令牌
    reset_token = PasswordResetToken(
        userId=user.id,
        token=token,
        expiresAt=expires_at
    )
    db.add(reset_token)
    db.commit()
    
    # 记录操作日志
    log = OperationLog(
        userId=user.id,
        action="update",
        description="请求重置密码"
    )
    db.add(log)
    db.commit()
    
    # 开发环境：返回令牌（生产环境应通过邮件发送）
    # 生产环境应该发送邮件，这里仅用于开发测试
    reset_url = f"http://localhost:3000/reset-password?token={token}"
    
    return ForgotPasswordResponse(
        message="重置链接已生成（开发环境）",
        resetToken=token  # 仅开发环境返回，生产环境应移除
    )

@router.post("/reset-password", response_model=ResetPasswordResponse)
async def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    """重置密码"""
    # 查找有效的重置令牌
    reset_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == request.token,
        PasswordResetToken.used == False,
        PasswordResetToken.expiresAt > datetime.utcnow()
    ).first()
    
    if not reset_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="重置令牌无效或已过期"
        )
    
    # 查找用户
    user = db.query(User).filter(User.id == reset_token.userId).first()
    if not user or user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户不存在或已被禁用"
        )
    
    # 验证新密码长度
    if len(request.newPassword) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="密码长度至少为6位"
        )
    
    # 更新密码
    user.password = get_password_hash(request.newPassword)
    
    # 标记令牌为已使用
    reset_token.used = True
    
    db.commit()
    
    # 记录操作日志
    log = OperationLog(
        userId=user.id,
        action="update",
        description="重置密码"
    )
    db.add(log)
    db.commit()
    
    return ResetPasswordResponse(
        message="密码重置成功"
    )


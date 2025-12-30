from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from models import UserRole, UserStatus, DocumentStatus, PermissionType, TaskStatus, TaskPriority, NotificationType

# 用户相关 Schema
class UserBase(BaseModel):
    username: str
    email: EmailStr
    phone: Optional[str] = None
    nickname: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    nickname: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

class UserResponse(UserBase):
    id: int
    avatar: Optional[str] = None
    role: UserRole
    status: UserStatus
    lastLoginAt: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime
    
    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    token: str
    user: UserResponse

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ForgotPasswordResponse(BaseModel):
    message: str
    resetToken: Optional[str] = None  # 开发环境返回令牌，生产环境应通过邮件发送

class ResetPasswordRequest(BaseModel):
    token: str
    newPassword: str

class ResetPasswordResponse(BaseModel):
    message: str

# 文档相关 Schema
class DocumentBase(BaseModel):
    title: str
    content: Optional[str] = None
    tags: Optional[str] = None
    folder: Optional[str] = None
    isPublic: bool = False

class DocumentCreate(DocumentBase):
    pass

class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[str] = None
    folder: Optional[str] = None
    isPublic: Optional[bool] = None
    status: Optional[DocumentStatus] = None

class DocumentResponse(DocumentBase):
    id: int
    creatorId: int
    status: DocumentStatus
    isLocked: bool = False  # 文档锁定状态
    lastEditedAt: Optional[datetime] = None
    lastEditedBy: Optional[int] = None
    createdAt: datetime
    updatedAt: datetime
    creator: Optional[UserResponse] = None
    
    class Config:
        from_attributes = True

# 评论相关 Schema
class CommentCreate(BaseModel):
    documentId: int
    content: str
    position: Optional[str] = None
    parentId: Optional[int] = None
    mentions: Optional[List[int]] = None

class CommentUpdate(BaseModel):
    content: Optional[str] = None

class CommentResponse(BaseModel):
    id: int
    documentId: int
    userId: int
    content: str
    position: Optional[str] = None
    parentId: Optional[int] = None
    mentions: Optional[str] = None
    isResolved: bool
    createdAt: datetime
    updatedAt: datetime
    user: Optional[UserResponse] = None
    
    class Config:
        from_attributes = True

# 任务相关 Schema
class TaskCreate(BaseModel):
    documentId: Optional[int] = None
    title: str
    description: Optional[str] = None
    assigneeId: int
    priority: TaskPriority = TaskPriority.medium
    dueDate: Optional[datetime] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    dueDate: Optional[datetime] = None
    assigneeId: Optional[int] = None

class TaskResponse(BaseModel):
    id: int
    documentId: Optional[int] = None
    title: str
    description: Optional[str] = None
    creatorId: int
    assigneeId: int
    status: TaskStatus
    priority: TaskPriority
    dueDate: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime
    creator: Optional[UserResponse] = None
    assignee: Optional[UserResponse] = None
    
    class Config:
        from_attributes = True

# 通知相关 Schema
class NotificationResponse(BaseModel):
    id: int
    userId: int
    type: NotificationType
    title: str
    content: Optional[str] = None
    relatedId: Optional[int] = None
    isRead: bool
    readAt: Optional[datetime] = None
    createdAt: datetime
    
    class Config:
        from_attributes = True

# 权限相关 Schema
class DocumentPermissionCreate(BaseModel):
    userId: int
    permission: PermissionType

class DocumentPermissionResponse(BaseModel):
    id: int
    documentId: int
    userId: int
    permission: PermissionType
    user: Optional[UserResponse] = None
    
    class Config:
        from_attributes = True

# 文档模板相关 Schema
class DocumentTemplateCreate(BaseModel):
    name: str
    title: str
    content: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    isPublic: bool = False

class DocumentTemplateUpdate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    isPublic: Optional[bool] = None

class DocumentTemplateResponse(BaseModel):
    id: int
    name: str
    title: str
    content: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    isPublic: bool
    creatorId: int
    usageCount: int
    createdAt: datetime
    updatedAt: datetime
    creator: Optional[UserResponse] = None
    
    class Config:
        from_attributes = True

class CreateDocumentFromTemplateRequest(BaseModel):
    templateId: int
    title: Optional[str] = None  # 如果提供，将覆盖模板的标题

# 文档版本相关 Schema
class DocumentVersionResponse(BaseModel):
    id: int
    documentId: int
    title: str
    content: Optional[str] = None
    versionNumber: int
    createdBy: int
    isLocked: bool = False
    createdAt: datetime
    creator: Optional[UserResponse] = None
    
    class Config:
        from_attributes = True

# 版本对比相关 Schema
class VersionCompareRequest(BaseModel):
    versionId1: int
    versionId2: int

class VersionDiff(BaseModel):
    type: str  # 'added', 'removed', 'modified', 'equal'
    content: str
    position: int
    start: Optional[int] = None  # 在文本中的起始位置
    end: Optional[int] = None    # 在文本中的结束位置

class VersionCompareResponse(BaseModel):
    version1: DocumentVersionResponse
    version2: DocumentVersionResponse
    version1Highlights: List[VersionDiff]  # 版本1的高亮信息（相对于版本2）
    version2Highlights: List[VersionDiff]  # 版本2的高亮信息（相对于版本1）

# 版本锁定相关 Schema
class VersionLockRequest(BaseModel):
    isLocked: bool

# 文档锁定相关 Schema
class DocumentLockRequest(BaseModel):
    isLocked: bool

# 用户标签相关 Schema
class UserTagBase(BaseModel):
    name: str

class UserTagCreate(UserTagBase):
    pass

class UserTagUpdate(BaseModel):
    name: Optional[str] = None

class UserTagResponse(UserTagBase):
    id: int
    userId: int
    createdAt: datetime
    updatedAt: datetime
    
    class Config:
        from_attributes = True

# 用户文件夹相关 Schema
class UserFolderBase(BaseModel):
    name: str
    parentId: Optional[int] = None

class UserFolderCreate(UserFolderBase):
    pass

class UserFolderUpdate(BaseModel):
    name: Optional[str] = None
    parentId: Optional[int] = None

class UserFolderResponse(UserFolderBase):
    id: int
    userId: int
    createdAt: datetime
    updatedAt: datetime
    
    class Config:
        from_attributes = True


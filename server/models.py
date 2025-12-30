from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum

class UserRole(str, enum.Enum):
    admin = "admin"
    editor = "editor"
    viewer = "viewer"

class UserStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    banned = "banned"

class DocumentStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    archived = "archived"

class PermissionType(str, enum.Enum):
    read = "read"
    write = "write"
    admin = "admin"

class TaskStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"

class TaskPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"

class NotificationType(str, enum.Enum):
    edit = "edit"
    comment = "comment"
    task = "task"
    mention = "mention"
    permission = "permission"
    system = "system"
    video_conference = "video_conference"

class OperationAction(str, enum.Enum):
    create = "create"
    read = "read"
    update = "update"
    delete = "delete"
    share = "share"
    export = "export"
    import_action = "import"

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    phone = Column(String(20), unique=True, nullable=True, index=True)
    password = Column(String(255), nullable=False)
    nickname = Column(String(50), nullable=True)
    avatar = Column(String(255), nullable=True)
    role = Column(Enum(UserRole), default=UserRole.viewer, nullable=False)
    status = Column(Enum(UserStatus), default=UserStatus.active, nullable=False)
    lastLoginAt = Column(DateTime, nullable=True)
    createdAt = Column(DateTime, server_default=func.now(), nullable=False)
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # 关系
    created_documents = relationship("Document", back_populates="creator", foreign_keys="Document.creatorId")
    document_permissions = relationship("DocumentPermission", back_populates="user")
    comments = relationship("Comment", back_populates="user")
    created_tasks = relationship("Task", back_populates="creator", foreign_keys="Task.creatorId")
    assigned_tasks = relationship("Task", back_populates="assignee", foreign_keys="Task.assigneeId")
    notifications = relationship("Notification", back_populates="user")
    operation_logs = relationship("OperationLog", back_populates="user")
    tags = relationship("UserTag", back_populates="user")
    folders = relationship("UserFolder", back_populates="user")

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=True)
    tags = Column(String(500), nullable=True)
    folder = Column(String(200), nullable=True)
    creatorId = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    isPublic = Column(Boolean, default=False, nullable=False, index=True)
    status = Column(Enum(DocumentStatus), default=DocumentStatus.draft, nullable=False, index=True)
    isLocked = Column(Boolean, default=False, nullable=False, index=True)  # 文档锁定状态
    lastEditedAt = Column(DateTime, nullable=True)
    lastEditedBy = Column(Integer, ForeignKey("users.id"), nullable=True)
    createdAt = Column(DateTime, server_default=func.now(), nullable=False)
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # 关系
    creator = relationship("User", back_populates="created_documents", foreign_keys=[creatorId])
    permissions = relationship("DocumentPermission", back_populates="document")
    comments = relationship("Comment", back_populates="document")
    tasks = relationship("Task", back_populates="document")
    operation_logs = relationship("OperationLog", back_populates="document")
    versions = relationship("DocumentVersion", back_populates="document", cascade="all, delete-orphan")

class DocumentPermission(Base):
    __tablename__ = "document_permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    documentId = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)
    userId = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    permission = Column(Enum(PermissionType), default=PermissionType.read, nullable=False)
    createdAt = Column(DateTime, server_default=func.now(), nullable=False)
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # 关系
    document = relationship("Document", back_populates="permissions")
    user = relationship("User", back_populates="document_permissions")

class Comment(Base):
    __tablename__ = "comments"
    
    id = Column(Integer, primary_key=True, index=True)
    documentId = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)
    userId = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    position = Column(String(100), nullable=True)
    parentId = Column(Integer, ForeignKey("comments.id"), nullable=True, index=True)
    mentions = Column(String(500), nullable=True)
    isResolved = Column(Boolean, default=False, nullable=False)
    createdAt = Column(DateTime, server_default=func.now(), nullable=False)
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # 关系
    document = relationship("Document", back_populates="comments")
    user = relationship("User", back_populates="comments")
    parent = relationship("Comment", remote_side=[id])

class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    documentId = Column(Integer, ForeignKey("documents.id"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    creatorId = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    assigneeId = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(Enum(TaskStatus), default=TaskStatus.pending, nullable=False, index=True)
    priority = Column(Enum(TaskPriority), default=TaskPriority.medium, nullable=False)
    dueDate = Column(DateTime, nullable=True)
    completedAt = Column(DateTime, nullable=True)
    createdAt = Column(DateTime, server_default=func.now(), nullable=False)
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # 关系
    document = relationship("Document", back_populates="tasks")
    creator = relationship("User", back_populates="created_tasks", foreign_keys=[creatorId])
    assignee = relationship("User", back_populates="assigned_tasks", foreign_keys=[assigneeId])

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    userId = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(Enum(NotificationType), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=True)
    relatedId = Column(Integer, nullable=True)
    isRead = Column(Boolean, default=False, nullable=False, index=True)
    readAt = Column(DateTime, nullable=True)
    createdAt = Column(DateTime, server_default=func.now(), nullable=False)
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # 关系
    user = relationship("User", back_populates="notifications")

class OperationLog(Base):
    __tablename__ = "operation_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    userId = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    documentId = Column(Integer, ForeignKey("documents.id"), nullable=True, index=True)
    action = Column(Enum(OperationAction), nullable=False, index=True)
    description = Column(Text, nullable=True)
    createdAt = Column(DateTime, server_default=func.now(), nullable=False, index=True)
    
    # 关系
    user = relationship("User", back_populates="operation_logs")
    document = relationship("Document", back_populates="operation_logs")

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    userId = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String(255), unique=True, nullable=False, index=True)
    expiresAt = Column(DateTime, nullable=False, index=True)
    used = Column(Boolean, default=False, nullable=False, index=True)
    createdAt = Column(DateTime, server_default=func.now(), nullable=False)
    
    # 关系
    user = relationship("User")

class DocumentVersion(Base):
    __tablename__ = "document_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    documentId = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=True)
    versionNumber = Column(Integer, nullable=False, index=True)
    createdBy = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    isLocked = Column(Boolean, default=False, nullable=False, index=True)
    createdAt = Column(DateTime, server_default=func.now(), nullable=False, index=True)
    
    # 关系
    document = relationship("Document", back_populates="versions")
    creator = relationship("User", foreign_keys=[createdBy])

class DocumentTemplate(Base):
    __tablename__ = "document_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=True)
    category = Column(String(50), nullable=True, index=True)
    description = Column(Text, nullable=True)
    isPublic = Column(Boolean, default=False, nullable=False, index=True)
    creatorId = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    usageCount = Column(Integer, default=0, nullable=False)
    createdAt = Column(DateTime, server_default=func.now(), nullable=False)
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # 关系
    creator = relationship("User")

class UserTag(Base):
    __tablename__ = "user_tags"
    
    id = Column(Integer, primary_key=True, index=True)
    userId = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    createdAt = Column(DateTime, server_default=func.now(), nullable=False)
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # 关系
    user = relationship("User", back_populates="tags")
    
    # 唯一约束：同一用户的标签名称不能重复
    __table_args__ = (
        {'mysql_engine': 'InnoDB'},
    )

class UserFolder(Base):
    __tablename__ = "user_folders"
    
    id = Column(Integer, primary_key=True, index=True)
    userId = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    parentId = Column(Integer, ForeignKey("user_folders.id"), nullable=True)  # 支持文件夹嵌套
    createdAt = Column(DateTime, server_default=func.now(), nullable=False)
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # 关系
    user = relationship("User", back_populates="folders")
    parent = relationship("UserFolder", remote_side=[id], backref="children")
    
    # 唯一约束：同一用户的文件夹名称在同一层级不能重复
    __table_args__ = (
        {'mysql_engine': 'InnoDB'},
    )


from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime, timedelta
import difflib
import html
from database import get_db
from models import Document, DocumentPermission, User, OperationLog, PermissionType, Comment, Task, Notification, NotificationType, UserRole, DocumentVersion
from schemas import DocumentCreate, DocumentUpdate, DocumentResponse, DocumentPermissionCreate, DocumentPermissionResponse, DocumentVersionResponse, VersionCompareRequest, VersionCompareResponse, VersionDiff, VersionLockRequest, DocumentLockRequest
from middleware import get_current_user

router = APIRouter()

@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_document(
    document_data: DocumentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """创建文档"""
    db_document = Document(
        title=document_data.title if document_data.title is not None else "",
        content=document_data.content or "",
        tags=document_data.tags,
        folder=document_data.folder,
        creatorId=current_user.id,
        isPublic=document_data.isPublic,
        lastEditedBy=current_user.id,
        lastEditedAt=datetime.utcnow()
    )
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    
    permission = DocumentPermission(
        documentId=db_document.id,
        userId=current_user.id,
        permission=PermissionType.admin
    )
    db.add(permission)
    
    initial_version = DocumentVersion(
        documentId=db_document.id,
        title=db_document.title,
        content=db_document.content,
        versionNumber=1,
        createdBy=current_user.id
    )
    db.add(initial_version)
    db.commit()
    
    log = OperationLog(
        userId=current_user.id,
        documentId=db_document.id,
        action="create",
        description=f"创建文档: {db_document.title}"
    )
    db.add(log)
    db.commit()
    
    return {"document": DocumentResponse.model_validate(db_document).model_dump()}

@router.get("")
@router.get("/")
async def get_documents(
    page: int = 1,
    limit: int = 20,
    folder: Optional[str] = None,
    search: Optional[str] = None,
    creatorId: Optional[int] = None,
    dateFrom: Optional[str] = None,
    dateTo: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取文档列表"""
    query = db.query(Document)
    
    if search:
        query = query.filter(
            or_(
                Document.title.like(f"%{search}%"),
                Document.content.like(f"%{search}%")
            )
        )
    if folder:
        query = query.filter(Document.folder == folder)
    if creatorId:
        query = query.filter(Document.creatorId == creatorId)
    if dateFrom:
        try:
            date_from = datetime.strptime(dateFrom, "%Y-%m-%d")
            query = query.filter(Document.createdAt >= date_from)
        except ValueError:
            pass
    if dateTo:
        try:
            date_to = datetime.strptime(dateTo, "%Y-%m-%d")
            date_to = date_to + timedelta(days=1)
            query = query.filter(Document.createdAt < date_to)
        except ValueError:
            pass
    
    user_permissions = db.query(DocumentPermission).filter(
        DocumentPermission.userId == current_user.id
    ).all()
    document_ids = [p.documentId for p in user_permissions]
    
    if current_user.role != "admin":
        query = query.filter(
            or_(
                Document.id.in_(document_ids),
                Document.isPublic == True
            )
        )
    
    documents = query.offset((page - 1) * limit).limit(limit).all()
    
    for doc in documents:
        doc.creator = db.query(User).filter(User.id == doc.creatorId).first()
    
    return {
        "documents": [DocumentResponse.model_validate(doc).model_dump() for doc in documents]
    }

@router.get("/{document_id}")
async def get_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取文档详情"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    permission = db.query(DocumentPermission).filter(
        DocumentPermission.documentId == document_id,
        DocumentPermission.userId == current_user.id
    ).first()
    
    if not document.isPublic and not permission and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="无权访问该文档")
    
    document.creator = db.query(User).filter(User.id == document.creatorId).first()
    
    log = OperationLog(
        userId=current_user.id,
        documentId=document_id,
        action="read",
        description=f"查看文档: {document.title}"
    )
    db.add(log)
    db.commit()
    
    response_data = {"document": DocumentResponse.model_validate(document).model_dump()}
    if permission:
        response_data["userPermission"] = permission.permission.value
    elif current_user.role == "admin" or document.creatorId == current_user.id:
        response_data["userPermission"] = "admin"
    else:
        response_data["userPermission"] = "read"
    
    return response_data

@router.put("/{document_id}")
async def update_document(
    document_id: int,
    document_update: DocumentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新文档"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    if document.isLocked:
        raise HTTPException(status_code=403, detail="文档已锁定，无法修改")
    
    permission = db.query(DocumentPermission).filter(
        DocumentPermission.documentId == document_id,
        DocumentPermission.userId == current_user.id
    ).first()
    
    has_edit_permission = False
    if permission and permission.permission in [PermissionType.write, PermissionType.admin]:
        has_edit_permission = True
    elif current_user.role == "admin":
        has_edit_permission = True
    elif document.creatorId == current_user.id:
        has_edit_permission = True
    
    if not has_edit_permission:
        raise HTTPException(status_code=403, detail="无权编辑该文档（只读权限）")
    
    update_data = document_update.model_dump(exclude_unset=True)
    
    has_changes = False
    title_changed = 'title' in update_data and update_data['title'] != document.title
    content_changed = 'content' in update_data and update_data['content'] != document.content
    
    if title_changed or content_changed:
        has_changes = True
    
    if has_changes:
        max_version = db.query(func.max(DocumentVersion.versionNumber)).filter(
            DocumentVersion.documentId == document_id
        ).scalar() or 0
        
        version = DocumentVersion(
            documentId=document_id,
            title=document.title,
            content=document.content,
            versionNumber=max_version + 1,
            createdBy=current_user.id
        )
        db.add(version)
        db.flush()
    
    for field, value in update_data.items():
        setattr(document, field, value)
    
    document.lastEditedBy = current_user.id
    document.lastEditedAt = datetime.utcnow()
    db.commit()
    db.refresh(document)
    
    log = OperationLog(
        userId=current_user.id,
        documentId=document_id,
        action="update",
        description=f"更新文档: {document.title}"
    )
    db.add(log)
    db.commit()
    
    return DocumentResponse.model_validate(document)

@router.delete("/{document_id}")
async def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除文档"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    if document.creatorId != current_user.id and current_user.role != "admin":
        permission = db.query(DocumentPermission).filter(
            DocumentPermission.documentId == document_id,
            DocumentPermission.userId == current_user.id,
            DocumentPermission.permission == PermissionType.admin
        ).first()
        if not permission:
            raise HTTPException(status_code=403, detail="无权删除该文档")
    
    document_title = document.title
    
    db.query(DocumentPermission).filter(
        DocumentPermission.documentId == document_id
    ).delete()
    
    db.query(Comment).filter(
        Comment.documentId == document_id
    ).delete()
    
    db.query(Task).filter(
        Task.documentId == document_id
    ).delete()
    
    log = OperationLog(
        userId=current_user.id,
        documentId=document_id,
        action="delete",
        description=f"删除文档: {document_title}"
    )
    db.add(log)
    
    db.delete(document)
    db.commit()
    
    return {"message": "文档删除成功"}

@router.post("/{document_id}/share", response_model=DocumentPermissionResponse)
async def share_document(
    document_id: int,
    permission_data: DocumentPermissionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """分享文档（设置权限）"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    if document.creatorId != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="只有文档创建者和管理员可以分享文档")
    
    permission = db.query(DocumentPermission).filter(
        DocumentPermission.documentId == document_id,
        DocumentPermission.userId == permission_data.userId
    ).first()
    
    if permission:
        permission.permission = permission_data.permission
    else:
        permission = DocumentPermission(
            documentId=document_id,
            userId=permission_data.userId,
            permission=permission_data.permission
        )
        db.add(permission)
    
    db.commit()
    db.refresh(permission)
    permission.user = db.query(User).filter(User.id == permission.userId).first()
    
    return DocumentPermissionResponse.model_validate(permission)

@router.get("/{document_id}/permissions", response_model=list[DocumentPermissionResponse])
async def get_document_permissions(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取文档权限列表"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    if current_user.role != "admin":
        user_permission = db.query(DocumentPermission).filter(
            DocumentPermission.documentId == document_id,
            DocumentPermission.userId == current_user.id
        ).first()
        if document.creatorId != current_user.id and not user_permission:
            raise HTTPException(status_code=403, detail="无权查看该文档的权限")
    
    permissions = db.query(DocumentPermission).filter(
        DocumentPermission.documentId == document_id
    ).all()
    
    for perm in permissions:
        perm.user = db.query(User).filter(User.id == perm.userId).first()
    
    return [DocumentPermissionResponse.model_validate(p) for p in permissions]

@router.put("/{document_id}/permissions/{permission_id}", response_model=DocumentPermissionResponse)
async def update_document_permission(
    document_id: int,
    permission_id: int,
    permission_data: DocumentPermissionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新文档权限（管理员或文档创建者）"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    permission = db.query(DocumentPermission).filter(
        DocumentPermission.id == permission_id,
        DocumentPermission.documentId == document_id
    ).first()
    
    if not permission:
        raise HTTPException(status_code=404, detail="权限不存在")
    
    if current_user.role != "admin" and document.creatorId != current_user.id:
        user_permission = db.query(DocumentPermission).filter(
            DocumentPermission.documentId == document_id,
            DocumentPermission.userId == current_user.id,
            DocumentPermission.permission == PermissionType.admin
        ).first()
        if not user_permission:
            raise HTTPException(status_code=403, detail="无权修改该文档的权限")
    
    permission.permission = permission_data.permission
    db.commit()
    db.refresh(permission)
    permission.user = db.query(User).filter(User.id == permission.userId).first()
    
    return DocumentPermissionResponse.model_validate(permission)

@router.delete("/{document_id}/permissions/{permission_id}")
async def delete_document_permission(
    document_id: int,
    permission_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除文档权限（管理员或文档创建者）"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    permission = db.query(DocumentPermission).filter(
        DocumentPermission.id == permission_id,
        DocumentPermission.documentId == document_id
    ).first()
    
    if not permission:
        raise HTTPException(status_code=404, detail="权限不存在")
    
    if current_user.role != "admin" and document.creatorId != current_user.id:
        user_permission = db.query(DocumentPermission).filter(
            DocumentPermission.documentId == document_id,
            DocumentPermission.userId == current_user.id,
            DocumentPermission.permission == PermissionType.admin
        ).first()
        if not user_permission:
            raise HTTPException(status_code=403, detail="无权删除该文档的权限")
    
    db.delete(permission)
    db.commit()
    
    return {"message": "权限删除成功"}

@router.post("/{document_id}/request-permission")
async def request_edit_permission(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """申请编辑权限"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    permission = db.query(DocumentPermission).filter(
        DocumentPermission.documentId == document_id,
        DocumentPermission.userId == current_user.id
    ).first()
    
    if permission and permission.permission in [PermissionType.write, PermissionType.admin]:
        raise HTTPException(status_code=400, detail="您已有编辑权限，无需申请")
    
    if current_user.role == UserRole.admin or document.creatorId == current_user.id:
        raise HTTPException(status_code=400, detail="您已有编辑权限，无需申请")
    
    existing_notifications = db.query(Notification).filter(
        Notification.type == NotificationType.permission,
        Notification.relatedId == document_id,
        Notification.isRead == False,
        Notification.content.like(f"%{current_user.email}%")
    ).all()
    
    if existing_notifications:
        raise HTTPException(status_code=400, detail="您已申请过编辑权限，请等待审核")
    
    creator = db.query(User).filter(User.id == document.creatorId).first()
    admins = db.query(User).filter(User.role == UserRole.admin).all()
    
    if creator and creator.id != current_user.id:
        notification_creator = Notification(
            userId=creator.id,
            type=NotificationType.permission,
            title="编辑权限申请",
            content=f"用户 {current_user.nickname or current_user.username} ({current_user.email}) 申请编辑文档《{document.title}》的权限",
            relatedId=document_id,
            isRead=False
        )
        db.add(notification_creator)
    
    for admin in admins:
        if admin.id != current_user.id and admin.id != document.creatorId:
            notification_admin = Notification(
                userId=admin.id,
                type=NotificationType.permission,
                title="编辑权限申请",
                content=f"用户 {current_user.nickname or current_user.username} ({current_user.email}) 申请编辑文档《{document.title}》的权限",
                relatedId=document_id,
                isRead=False
            )
            db.add(notification_admin)
    
    db.commit()
    
    log = OperationLog(
        userId=current_user.id,
        documentId=document_id,
        action="share",
        description=f"申请编辑文档权限: {document.title}"
    )
    db.add(log)
    db.commit()
    
    return {"message": "权限申请已提交，等待管理员或文档创建者审核"}

@router.get("/{document_id}/versions", response_model=list[DocumentVersionResponse])
async def get_document_versions(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取文档版本历史"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    permission = db.query(DocumentPermission).filter(
        DocumentPermission.documentId == document_id,
        DocumentPermission.userId == current_user.id
    ).first()
    
    has_permission = False
    if permission:
        has_permission = True
    elif current_user.role == "admin":
        has_permission = True
    elif document.creatorId == current_user.id:
        has_permission = True
    elif document.isPublic:
        has_permission = True
    
    if not has_permission:
        raise HTTPException(status_code=403, detail="无权查看该文档的版本历史")
    
    versions = db.query(DocumentVersion).filter(
        DocumentVersion.documentId == document_id
    ).order_by(DocumentVersion.versionNumber.desc()).all()
    
    if not versions:
        current_version = DocumentVersion(
            documentId=document_id,
            title=document.title,
            content=document.content,
            versionNumber=1,
            createdBy=document.lastEditedBy or document.creatorId
        )
        db.add(current_version)
        db.commit()
        db.refresh(current_version)
        
        versions = db.query(DocumentVersion).filter(
            DocumentVersion.documentId == document_id
        ).order_by(DocumentVersion.versionNumber.desc()).all()
    
    for version in versions:
        version.creator = db.query(User).filter(User.id == version.createdBy).first()
    
    return [DocumentVersionResponse.model_validate(v) for v in versions]

@router.post("/{document_id}/restore/{version_id}")
async def restore_document_version(
    document_id: int,
    version_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """恢复到指定版本"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    if document.isLocked:
        raise HTTPException(status_code=403, detail="文档已锁定，无法恢复到历史版本")
    
    permission = db.query(DocumentPermission).filter(
        DocumentPermission.documentId == document_id,
        DocumentPermission.userId == current_user.id
    ).first()
    
    has_edit_permission = False
    if permission and permission.permission in [PermissionType.write, PermissionType.admin]:
        has_edit_permission = True
    elif current_user.role == "admin":
        has_edit_permission = True
    elif document.creatorId == current_user.id:
        has_edit_permission = True
    
    if not has_edit_permission:
        raise HTTPException(status_code=403, detail="无权恢复该文档版本")
    
    version = db.query(DocumentVersion).filter(
        DocumentVersion.id == version_id,
        DocumentVersion.documentId == document_id
    ).first()
    
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")
    
    if version.isLocked:
        raise HTTPException(status_code=403, detail="该版本已被锁定，无法恢复")
    
    max_version = db.query(func.max(DocumentVersion.versionNumber)).filter(
        DocumentVersion.documentId == document_id
    ).scalar() or 0
    
    current_version = DocumentVersion(
        documentId=document_id,
        title=document.title,
        content=document.content,
        versionNumber=max_version + 1,
        createdBy=current_user.id
    )
    db.add(current_version)
    
    document.title = version.title
    document.content = version.content
    document.lastEditedBy = current_user.id
    document.lastEditedAt = datetime.utcnow()
    db.commit()
    db.refresh(document)
    
    log = OperationLog(
        userId=current_user.id,
        documentId=document_id,
        action="update",
        description=f"恢复到版本 {version.versionNumber}: {document.title}"
    )
    db.add(log)
    db.commit()
    
    return DocumentResponse.model_validate(document)


@router.post("/{document_id}/versions/compare", response_model=VersionCompareResponse)
async def compare_versions(
    document_id: int,
    request: VersionCompareRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """对比两个版本的差异"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    # 检查权限：至少需要read权限
    permission = db.query(DocumentPermission).filter(
        DocumentPermission.documentId == document_id,
        DocumentPermission.userId == current_user.id
    ).first()
    
    has_permission = False
    if permission:
        has_permission = True
    elif current_user.role == "admin":
        has_permission = True
    elif document.creatorId == current_user.id:
        has_permission = True
    elif document.isPublic:
        has_permission = True
    
    if not has_permission:
        raise HTTPException(status_code=403, detail="无权查看该文档的版本对比")
    
    version1 = db.query(DocumentVersion).filter(
        DocumentVersion.id == request.versionId1,
        DocumentVersion.documentId == document_id
    ).first()
    
    version2 = db.query(DocumentVersion).filter(
        DocumentVersion.id == request.versionId2,
        DocumentVersion.documentId == document_id
    ).first()
    
    if not version1 or not version2:
        raise HTTPException(status_code=404, detail="版本不存在")
    
    version1.creator = db.query(User).filter(User.id == version1.createdBy).first()
    version2.creator = db.query(User).filter(User.id == version2.createdBy).first()
    
    def strip_html_tags(text: str) -> str:
        """去除HTML标签，获取纯文本"""
        import re
        if not text:
            return ""
        text = html.unescape(text)
        text = re.sub(r'<[^>]+>', '', text)
        text = text.strip()
        return text
    
    def compute_highlights(text1: str, text2: str) -> tuple:
        """计算两个文本的差异，返回两个版本的高亮信息"""
        plain_text1 = strip_html_tags(text1 or "")
        plain_text2 = strip_html_tags(text2 or "")
        
        try:
            d = difflib.SequenceMatcher(None, plain_text1, plain_text2, autojunk=False)
        except TypeError:
            d = difflib.SequenceMatcher(None, plain_text1, plain_text2)
        
        highlights1 = []
        highlights2 = []
        
        for tag, i1, i2, j1, j2 in d.get_opcodes():
            if tag == 'equal':
                pass
            elif tag == 'delete':
                if i2 > i1:
                    highlights1.append(VersionDiff(
                        type="added",
                        content=plain_text1[i1:i2],
                        position=i1,
                        start=i1,
                        end=i2
                    ))
            elif tag == 'insert':
                if j2 > j1:
                    highlights2.append(VersionDiff(
                        type="removed",
                        content=plain_text2[j1:j2],
                        position=j1,
                        start=j1,
                        end=j2
                    ))
            elif tag == 'replace':
                if i2 > i1:
                    highlights1.append(VersionDiff(
                        type="added",
                        content=plain_text1[i1:i2],
                        position=i1,
                        start=i1,
                        end=i2
                    ))
                if j2 > j1:
                    highlights2.append(VersionDiff(
                        type="removed",
                        content=plain_text2[j1:j2],
                        position=j1,
                        start=j1,
                        end=j2
                    ))
        
        return highlights1, highlights2
    
    title_highlights1, title_highlights2 = compute_highlights(version1.title, version2.title)
    content_highlights1, content_highlights2 = compute_highlights(version1.content or "", version2.content or "")
    
    version1_highlights = title_highlights1 + content_highlights1
    version2_highlights = title_highlights2 + content_highlights2
    
    return VersionCompareResponse(
        version1=DocumentVersionResponse.model_validate(version1),
        version2=DocumentVersionResponse.model_validate(version2),
        version1Highlights=version1_highlights,
        version2Highlights=version2_highlights
    )

@router.put("/{document_id}/versions/{version_id}/lock")
async def lock_version(
    document_id: int,
    version_id: int,
    request: VersionLockRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """锁定/解锁版本（仅创建者和管理员）"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    is_creator = document.creatorId == current_user.id
    is_admin = current_user.role == UserRole.admin
    
    if not is_creator and not is_admin:
        raise HTTPException(status_code=403, detail="只有文档创建者和管理员可以锁定/解锁版本")
    
    version = db.query(DocumentVersion).filter(
        DocumentVersion.id == version_id,
        DocumentVersion.documentId == document_id
    ).first()
    
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")
    
    version.isLocked = request.isLocked
    db.commit()
    db.refresh(version)
    
    version.creator = db.query(User).filter(User.id == version.createdBy).first()
    
    action = "锁定" if request.isLocked else "解锁"
    log = OperationLog(
        userId=current_user.id,
        documentId=document_id,
        action="update",
        description=f"{action}版本 {version.versionNumber}: {document.title}"
    )
    db.add(log)
    db.commit()
    
    return DocumentVersionResponse.model_validate(version)

@router.put("/{document_id}/lock")
async def lock_document(
    document_id: int,
    request: DocumentLockRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """锁定/解锁文档（仅创建者和管理员）"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    is_creator = document.creatorId == current_user.id
    is_admin = current_user.role == UserRole.admin
    
    if not is_creator and not is_admin:
        raise HTTPException(status_code=403, detail="只有文档创建者和管理员可以锁定/解锁文档")
    
    document.isLocked = request.isLocked
    db.commit()
    db.refresh(document)
    
    action = "锁定" if request.isLocked else "解锁"
    log = OperationLog(
        userId=current_user.id,
        documentId=document_id,
        action="update",
        description=f"{action}文档: {document.title}"
    )
    db.add(log)
    db.commit()
    
    try:
        from socket_handler import sio
        room = f"document:{document_id}"
        await sio.emit('document_locked', {
            'documentId': document_id,
            'isLocked': document.isLocked,
            'userId': current_user.id,
            'timestamp': datetime.utcnow().isoformat()
        }, room=room)
    except Exception as e:
        print(f"Socket.IO 同步锁定状态失败: {e}")
    
    return DocumentResponse.model_validate(document)

class VideoInviteRequest(BaseModel):
    userIds: List[int]

@router.post("/{document_id}/video-invite")
async def invite_to_video_conference(
    document_id: int,
    invite_data: VideoInviteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """邀请用户加入视频会议"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    permission = db.query(DocumentPermission).filter(
        DocumentPermission.documentId == document_id,
        DocumentPermission.userId == current_user.id
    ).first()
    
    if not permission and document.creatorId != current_user.id:
        raise HTTPException(status_code=403, detail="无权邀请用户加入该文档的视频会议")
    
    userIds = invite_data.userIds
    if not userIds:
        raise HTTPException(status_code=400, detail="请选择要邀请的用户")
    
    notifications = []
    for user_id in userIds:
        if user_id == current_user.id:
            continue
        
        invited_user = db.query(User).filter(User.id == user_id).first()
        if not invited_user:
            continue
        
        notification = Notification(
            userId=user_id,
            type=NotificationType.video_conference,
            title=f"{current_user.nickname or current_user.username} 邀请你加入文档《{document.title}》的视频会议",
            content=f"点击加入视频会议",
            relatedId=document_id
        )
        db.add(notification)
        notifications.append(notification)
    
    db.commit()
    
    return {
        "message": f"已成功邀请 {len(notifications)} 位用户",
        "invitedCount": len(notifications)
    }


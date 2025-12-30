from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from database import get_db
from models import DocumentTemplate, User, OperationLog
from schemas import (
    DocumentTemplateCreate, 
    DocumentTemplateUpdate, 
    DocumentTemplateResponse,
    DocumentCreate,
    DocumentResponse
)
from middleware import get_current_user, require_role
from datetime import datetime

router = APIRouter()

@router.post("", response_model=DocumentTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    template_data: DocumentTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """创建文档模板"""
    # 检查模板名称是否已存在（同一用户）
    existing = db.query(DocumentTemplate).filter(
        DocumentTemplate.name == template_data.name,
        DocumentTemplate.creatorId == current_user.id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="模板名称已存在"
        )
    
    template = DocumentTemplate(
        name=template_data.name,
        title=template_data.title,
        content=template_data.content,
        category=template_data.category,
        description=template_data.description,
        isPublic=template_data.isPublic,
        creatorId=current_user.id
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    
    # 记录操作日志
    log = OperationLog(
        userId=current_user.id,
        action="create",
        description=f"创建文档模板: {template_data.name}"
    )
    db.add(log)
    db.commit()
    
    return DocumentTemplateResponse.model_validate(template)

@router.get("", response_model=List[DocumentTemplateResponse])
async def get_templates(
    category: Optional[str] = None,
    public_only: bool = False,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取模板列表"""
    query = db.query(DocumentTemplate)
    
    if public_only:
        # 只获取公开模板
        query = query.filter(DocumentTemplate.isPublic == True)
    elif current_user:
        # 获取公开模板和当前用户创建的模板
        query = query.filter(
            or_(
                DocumentTemplate.isPublic == True,
                DocumentTemplate.creatorId == current_user.id
            )
        )
    else:
        # 未登录用户只能看到公开模板
        query = query.filter(DocumentTemplate.isPublic == True)
    
    if category:
        query = query.filter(DocumentTemplate.category == category)
    
    templates = query.order_by(DocumentTemplate.createdAt.desc()).all()
    return [DocumentTemplateResponse.model_validate(t) for t in templates]

@router.get("/{template_id}", response_model=DocumentTemplateResponse)
async def get_template(
    template_id: int,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取模板详情"""
    template = db.query(DocumentTemplate).filter(DocumentTemplate.id == template_id).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    # 检查权限：公开模板或创建者可以查看
    if not template.isPublic:
        if not current_user or template.creatorId != current_user.id:
            raise HTTPException(status_code=403, detail="无权访问该模板")
    
    return DocumentTemplateResponse.model_validate(template)

@router.put("/{template_id}", response_model=DocumentTemplateResponse)
async def update_template(
    template_id: int,
    template_data: DocumentTemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新模板"""
    template = db.query(DocumentTemplate).filter(DocumentTemplate.id == template_id).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    # 只有创建者可以更新
    if template.creatorId != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="无权修改该模板")
    
    # 如果更新名称，检查是否与其他模板冲突
    if template_data.name and template_data.name != template.name:
        existing = db.query(DocumentTemplate).filter(
            DocumentTemplate.name == template_data.name,
            DocumentTemplate.creatorId == current_user.id,
            DocumentTemplate.id != template_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="模板名称已存在"
            )
    
    # 更新字段
    update_data = template_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)
    
    db.commit()
    db.refresh(template)
    
    # 记录操作日志
    log = OperationLog(
        userId=current_user.id,
        action="update",
        description=f"更新文档模板: {template.name}"
    )
    db.add(log)
    db.commit()
    
    return DocumentTemplateResponse.model_validate(template)

@router.delete("/{template_id}")
async def delete_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除模板"""
    template = db.query(DocumentTemplate).filter(DocumentTemplate.id == template_id).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    # 只有创建者或管理员可以删除
    if template.creatorId != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="无权删除该模板")
    
    template_name = template.name
    db.delete(template)
    db.commit()
    
    # 记录操作日志
    log = OperationLog(
        userId=current_user.id,
        action="delete",
        description=f"删除文档模板: {template_name}"
    )
    db.add(log)
    db.commit()
    
    return {"message": "模板删除成功"}

@router.post("/{template_id}/create-document")
async def create_document_from_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """使用模板创建文档"""
    template = db.query(DocumentTemplate).filter(DocumentTemplate.id == template_id).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    # 检查权限：公开模板或创建者可以使用
    if not template.isPublic:
        if template.creatorId != current_user.id:
            raise HTTPException(status_code=403, detail="无权使用该模板")
    
    # 创建文档
    from models import Document, DocumentPermission, PermissionType
    document = Document(
        title=template.title,
        content=template.content,
        creatorId=current_user.id,
        lastEditedBy=current_user.id,
        lastEditedAt=datetime.utcnow()
    )
    db.add(document)
    db.flush()  # 获取 document.id
    
    # 创建者自动拥有管理员权限
    permission = DocumentPermission(
        documentId=document.id,
        userId=current_user.id,
        permission=PermissionType.admin
    )
    db.add(permission)
    
    # 增加模板使用次数
    template.usageCount += 1
    
    db.commit()
    db.refresh(document)
    
    # 记录操作日志
    log = OperationLog(
        userId=current_user.id,
        documentId=document.id,
        action="create",
        description=f"使用模板创建文档: {template.name}"
    )
    db.add(log)
    db.commit()
    
    # 返回格式与 documents.py 保持一致
    return {"document": DocumentResponse.model_validate(document)}


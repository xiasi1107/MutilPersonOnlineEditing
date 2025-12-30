from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import Comment, Document, User, Notification, NotificationType
from schemas import CommentCreate, CommentUpdate, CommentResponse
from middleware import get_current_user

router = APIRouter()

# API 路由: 创建评论
@router.post("", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def create_comment(
    comment_data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """创建评论"""
    if not comment_data.content:
        raise HTTPException(status_code=400, detail="评论内容不能为空")
    
    # 创建评论记录
    db_comment = Comment(
        documentId=comment_data.documentId,
        userId=current_user.id,
        content=comment_data.content,
        position=comment_data.position,
        parentId=comment_data.parentId,
        mentions=",".join(map(str, comment_data.mentions)) if comment_data.mentions else None
    )
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    
    # 获取文档信息用于通知
    document = None
    if comment_data.documentId:
        document = db.query(Document).filter(Document.id == comment_data.documentId).first()
    doc_title = document.title if document else "未知文档"
    
    # 通知被提及的用户
    if comment_data.mentions:
        for user_id in comment_data.mentions:
            if user_id != current_user.id:
                notification = Notification(
                    userId=user_id,
                    type=NotificationType.mention,
                    title=f"{current_user.nickname or current_user.username} 在文档《{doc_title}》中提到了你",
                    content=comment_data.content,
                    relatedId=comment_data.documentId
                )
                db.add(notification)
    
    # 如果是回复，通知父评论作者
    if comment_data.parentId:
        parent_comment = db.query(Comment).filter(Comment.id == comment_data.parentId).first()
        if parent_comment and parent_comment.userId != current_user.id:
            notification = Notification(
                userId=parent_comment.userId,
                type=NotificationType.comment,
                title=f"{current_user.nickname or current_user.username} 在文档《{doc_title}》中回复了你的评论",
                content=comment_data.content,
                relatedId=comment_data.documentId
            )
            db.add(notification)
    
    db.commit()
    db_comment.user = current_user
    
    return CommentResponse.model_validate(db_comment)

# API 路由: 获取文档评论列表
@router.get("/document/{document_id}", response_model=list[CommentResponse])
async def get_document_comments(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取文档评论列表"""
    comments = db.query(Comment).filter(
        Comment.documentId == document_id
    ).order_by(Comment.createdAt.asc()).all()
    
    for comment in comments:
        comment.user = db.query(User).filter(User.id == comment.userId).first()
    
    return [CommentResponse.model_validate(c) for c in comments]

# API 路由: 更新评论
@router.put("/{comment_id}", response_model=CommentResponse)
async def update_comment(
    comment_id: int,
    comment_update: CommentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新评论"""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")
    
    # 权限检查: 只有评论作者或管理员可以修改
    if comment.userId != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="无权修改该评论")
    
    # 更新评论字段
    update_data = comment_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(comment, field, value)
    
    db.commit()
    db.refresh(comment)
    comment.user = db.query(User).filter(User.id == comment.userId).first()
    
    return CommentResponse.model_validate(comment)

# API 路由: 删除评论
@router.delete("/{comment_id}")
async def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除评论"""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")
    
    # 权限检查: 只有评论作者或管理员可以删除
    if comment.userId != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="无权删除该评论")
    
    db.delete(comment)
    db.commit()
    
    return {"message": "评论删除成功"}


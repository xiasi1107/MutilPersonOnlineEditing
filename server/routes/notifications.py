from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from models import Notification, NotificationType
from schemas import NotificationResponse
from middleware import get_current_user
from datetime import datetime

router = APIRouter()

# 同时支持有和没有尾部斜杠的路由
@router.get("", response_model=list[NotificationResponse])
@router.get("/", response_model=list[NotificationResponse])
async def get_notifications(
    page: int = 1,
    limit: int = 20,
    type_filter: Optional[NotificationType] = None,
    is_read: Optional[bool] = None,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取通知列表"""
    query = db.query(Notification).filter(Notification.userId == current_user.id)
    
    if type_filter:
        query = query.filter(Notification.type == type_filter)
    if is_read is not None:
        query = query.filter(Notification.isRead == is_read)
    
    notifications = query.order_by(Notification.createdAt.desc()).offset((page - 1) * limit).limit(limit).all()
    
    return [NotificationResponse.model_validate(n) for n in notifications]

@router.get("/unread-count")
async def get_unread_count(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取未读通知数量"""
    count = db.query(Notification).filter(
        Notification.userId == current_user.id,
        Notification.isRead == False
    ).count()
    
    return {"count": count}

@router.put("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """标记通知为已读"""
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="通知不存在")
    
    if notification.userId != current_user.id:
        raise HTTPException(status_code=403, detail="无权操作该通知")
    
    notification.isRead = True
    notification.readAt = datetime.utcnow()
    db.commit()
    db.refresh(notification)
    
    return NotificationResponse.model_validate(notification)

@router.put("/read-all")
async def mark_all_read(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """标记所有通知为已读"""
    db.query(Notification).filter(
        Notification.userId == current_user.id,
        Notification.isRead == False
    ).update({"isRead": True, "readAt": datetime.utcnow()})
    db.commit()
    
    return {"message": "所有通知已标记为已读"}

@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除通知"""
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="通知不存在")
    
    if notification.userId != current_user.id:
        raise HTTPException(status_code=403, detail="无权删除该通知")
    
    db.delete(notification)
    db.commit()
    
    return {"message": "通知删除成功"}


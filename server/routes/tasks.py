from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
from database import get_db
from models import Task, Document, User, Notification, TaskStatus, TaskPriority
from schemas import TaskCreate, TaskUpdate, TaskResponse
from middleware import get_current_user
from datetime import datetime

router = APIRouter()

@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_data: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """创建任务"""
    if not task_data.title or not task_data.assigneeId:
        raise HTTPException(status_code=400, detail="任务标题和分配者不能为空")
    
    db_task = Task(
        documentId=task_data.documentId,
        title=task_data.title,
        description=task_data.description,
        creatorId=current_user.id,
        assigneeId=task_data.assigneeId,
        priority=task_data.priority,
        dueDate=task_data.dueDate
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    # 获取文档信息
    document = None
    if task_data.documentId:
        document = db.query(Document).filter(Document.id == task_data.documentId).first()
    
    # 创建通知
    doc_title = document.title if document else "未知文档"
    notification = Notification(
        userId=task_data.assigneeId,
        type="task",
        title=f"{current_user.nickname or current_user.username} 在文档《{doc_title}》中分配了任务给你",
        content=task_data.title,
        relatedId=task_data.documentId
    )
    db.add(notification)
    db.commit()
    
    db_task.creator = current_user
    db_task.assignee = db.query(User).filter(User.id == task_data.assigneeId).first()
    if task_data.documentId:
        db_task.document = document
    
    return TaskResponse.model_validate(db_task)

@router.get("/", response_model=list[TaskResponse])
async def get_tasks(
    status: Optional[TaskStatus] = None,
    assignee_id: Optional[int] = None,
    creator_id: Optional[int] = None,
    document_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取任务列表"""
    query = db.query(Task)
    
    # 普通用户只能查看分配给自己的任务或自己创建的任务
    if current_user.role != "admin":
        query = query.filter(
            or_(
                Task.assigneeId == current_user.id,
                Task.creatorId == current_user.id
            )
        )
    
    if status:
        query = query.filter(Task.status == status)
    if assignee_id:
        query = query.filter(Task.assigneeId == assignee_id)
    if creator_id:
        query = query.filter(Task.creatorId == creator_id)
    if document_id:
        query = query.filter(Task.documentId == document_id)
    
    # 获取所有任务
    tasks = query.all()
    
    # 优先级排序映射：high=3, medium=2, low=1
    # 注意：TaskPriority 是枚举，需要转换为字符串或直接比较
    priority_map = {
        TaskPriority.high: 3,
        TaskPriority.medium: 2,
        TaskPriority.low: 1
    }
    
    # 排序：先按截止日期升序（NULL 放最后），再按优先级降序（high > medium > low）
    def sort_key(task):
        # 截止日期：有日期的排在前面，NULL 值用最大值表示（排在最后）
        if task.dueDate:
            due_date_key = task.dueDate
        else:
            # 使用一个很远的未来日期作为 NULL 值的排序键
            due_date_key = datetime(9999, 12, 31)
        
        # 优先级：数字越大越靠前（high=3 > medium=2 > low=1）
        # 处理枚举值：如果 task.priority 是字符串，需要转换为枚举
        if isinstance(task.priority, str):
            try:
                priority_enum = TaskPriority(task.priority)
            except (ValueError, AttributeError):
                priority_enum = TaskPriority.medium
        else:
            priority_enum = task.priority
        
        priority_key = priority_map.get(priority_enum, 2)  # 默认 medium
        return (due_date_key, -priority_key)  # 优先级用负数实现降序
    
    tasks = sorted(tasks, key=sort_key)
    
    for task in tasks:
        task.creator = db.query(User).filter(User.id == task.creatorId).first()
        task.assignee = db.query(User).filter(User.id == task.assigneeId).first()
        if task.documentId:
            task.document = db.query(Document).filter(Document.id == task.documentId).first()
    
    return [TaskResponse.model_validate(t) for t in tasks]

@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    task_update: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新任务"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    # 只有创建者、分配者或管理员可以更新
    if task.creatorId != current_user.id and task.assigneeId != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="无权修改该任务")
    
    update_data = task_update.model_dump(exclude_unset=True)
    old_status = task.status
    
    for field, value in update_data.items():
        setattr(task, field, value)
    
    # 如果任务完成，设置完成时间
    if task_update.status == TaskStatus.completed and old_status != TaskStatus.completed:
        task.completedAt = datetime.utcnow()
        # 获取文档信息
        document = None
        if task.documentId:
            document = db.query(Document).filter(Document.id == task.documentId).first()
        doc_title = document.title if document else "未知文档"
        # 通知创建者
        notification = Notification(
            userId=task.creatorId,
            type="task",
            title=f"文档《{doc_title}》中的任务已完成: {task.title}",
            content=f"{current_user.nickname or current_user.username} 完成了任务",
            relatedId=task.documentId
        )
        db.add(notification)
    
    # 如果重新分配，通知新的分配者
    if task_update.assigneeId and task_update.assigneeId != task.assigneeId:
        # 获取文档信息
        document = None
        if task.documentId:
            document = db.query(Document).filter(Document.id == task.documentId).first()
        doc_title = document.title if document else "未知文档"
        notification = Notification(
            userId=task_update.assigneeId,
            type="task",
            title=f"{current_user.nickname or current_user.username} 在文档《{doc_title}》中分配了任务给你",
            content=task.title,
            relatedId=task.documentId
        )
        db.add(notification)
    
    db.commit()
    db.refresh(task)
    task.creator = db.query(User).filter(User.id == task.creatorId).first()
    task.assignee = db.query(User).filter(User.id == task.assigneeId).first()
    
    return TaskResponse.model_validate(task)

@router.delete("/{task_id}")
async def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除任务"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    if task.creatorId != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="无权删除该任务")
    
    db.delete(task)
    db.commit()
    
    return {"message": "任务删除成功"}


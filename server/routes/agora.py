from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from middleware import get_current_user
from models import User
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

# Agora 配置
# 此项目未启用 App Certificate（安全模式），不需要 Token
AGORA_APP_ID = os.getenv('AGORA_APP_ID', '04774e1fa58546d9a731066868f0eb83')

@router.get("/appid")
async def get_agora_app_id(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """返回 Agora App ID（无需 Token）"""
    try:
        # 日志输出（用于调试）
        print(f"[Agora] 返回 App ID: {AGORA_APP_ID} (长度: {len(AGORA_APP_ID)})")
        
        return {
            "appId": AGORA_APP_ID
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取 App ID 失败: {str(e)}"
        )


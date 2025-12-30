from jose import JWTError, jwt
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
import bcrypt

load_dotenv()

# 密码加密配置
BCRYPT_ROUNDS = 12

# JWT 配置
SECRET_KEY = os.getenv("JWT_SECRET", "your_jwt_secret_key_here")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

# 密码验证函数
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    try:
        if isinstance(plain_password, str):
            password_bytes = plain_password.encode('utf-8')
        else:
            password_bytes = plain_password
        
        if len(password_bytes) > 72:
            password_bytes = password_bytes[:72]
        
        if isinstance(hashed_password, bytes):
            hashed_bytes = hashed_password
        else:
            hashed_bytes = hashed_password.encode('utf-8')
        
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception as e:
        print(f"密码验证错误: {e}")
        import traceback
        traceback.print_exc()
        return False

# 密码加密函数
def get_password_hash(password: str) -> str:
    """加密密码"""
    try:
        if isinstance(password, str):
            password_bytes = password.encode('utf-8')
        else:
            password_bytes = password
        
        if len(password_bytes) > 72:
            password_bytes = password_bytes[:72]
        
        salt = bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
        hashed = bcrypt.hashpw(password_bytes, salt)
        return hashed.decode('utf-8')
    except Exception as e:
        print(f"密码加密错误: {e}")
        raise

# JWT Token 创建函数
def create_access_token(data: dict, expires_delta: timedelta = None):
    """创建 JWT token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# JWT Token 解码函数
def decode_access_token(token: str):
    """解码 JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


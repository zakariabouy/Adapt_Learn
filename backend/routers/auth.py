from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from shared.models import UserCreate, User, Token, TokenData, Role
from shared.security import get_password_hash, verify_password, create_access_token, SECRET_KEY, ALGORITHM
from shared.database import get_pool
import asyncpg
from uuid import UUID

router = APIRouter(prefix="/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        role: str = payload.get("role")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email, role=role)
    except JWTError:
        raise credentials_exception
    
    pool = await get_pool()
    user = await pool.fetchrow("SELECT id, email, role, name, created_at FROM users WHERE email = $1", token_data.email)
    
    if user is None:
        raise credentials_exception
    return user

@router.post("/register", response_model=User)
async def register(user_in: UserCreate):
    pool = await get_pool()
    
    # Check if user exists
    existing_user = await pool.fetchrow("SELECT id FROM users WHERE email = $1", user_in.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user_in.password)
    
    # Insert user
    new_user = await pool.fetchrow(
        "INSERT INTO users (email, role, hashed_password, name, grade_level) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, role, name, created_at",
        user_in.email, user_in.role.value, hashed_password, user_in.name, user_in.grade_level
    )
    
    return dict(new_user)

# JSON-based login model (replaces OAuth2PasswordRequestForm which has multipart bugs)
class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/login", response_model=Token)
async def login(login_data: LoginRequest):
    pool = await get_pool()
    user = await pool.fetchrow(
        "SELECT id, email, role, hashed_password FROM users WHERE email = $1", 
        login_data.email
    )
    
    if not user or not verify_password(login_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    access_token = create_access_token(data={"sub": user["email"], "role": user["role"]})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=User)
async def read_users_me(current_user = Depends(get_current_user)):
    return dict(current_user)


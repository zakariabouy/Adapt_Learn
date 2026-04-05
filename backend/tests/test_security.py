import pytest
import sys
import os
from datetime import timedelta

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from shared.security import get_password_hash, verify_password, create_access_token

def test_password_hashing():
    """Passwords should be hashed and verifiable."""
    password = "secure_password_123"
    hashed = get_password_hash(password)
    
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("wrong_password", hashed) is False

def test_token_creation():
    """Access tokens should be created successfully."""
    data = {"sub": "test@example.com", "role": "student"}
    token = create_access_token(data)
    
    assert isinstance(token, str)
    assert len(token) > 0

def test_token_expiration():
    """Tokens should respect custom expiration deltas."""
    data = {"sub": "expire@example.com"}
    expires = timedelta(minutes=1)
    token = create_access_token(data, expires_delta=expires)
    
    assert isinstance(token, str)

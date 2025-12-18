from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
import os
from dotenv import load_dotenv

# load the env vars
load_dotenv()

# configure a password-hashing context using Passlib
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# init the JWT var settings
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))

# func to hash passwords
def hash_password(password: str) -> str:
    """
    Hash a plain text password.
    
    Example:
        hashed = hash_password("mypassword123")
        # Returns: "$2b$
    """
    return pwd_context.hash(password)

# func to verify plain password == hashed_pw
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against a hashed password.
    
    Example:
        is_valid = verify_password("mypassword123", user.password_hash)
        # Returns: True or False
    """
    return pwd_context.verify(plain_password, hashed_password)

# func to create JWT token for user
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.
    
    Args:
        data: Dictionary to encode (usually {"sub": user_email})
        expires_delta: Optional custom expiration time
        
    Example:
        token = create_access_token({"sub": "user@example.com"})
        # Returns: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    """
    # make a copy of the data so we don't modify the original dict
    to_encode = data.copy()
    
    # determine the expiration time for the token
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # this tells JWT when the token should become invalid
    to_encode.update({"exp": expire})
    # encode and sign the JWT using the secret key and algorithm
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    return encoded_jwt

# func to check if JWT token is valid
def verify_token(token: str) -> Optional[str]:
    """
    Verify a JWT token and return the user email.
    
    Args:
        token: JWT token string
        
    Returns:
        User email if valid, None if invalid
        
    Example:
        email = verify_token(token)
        # Returns: "user@example.com" or None
    """
    # decode and verify the JWT using the secret key and algorithm
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # get the "sub" (subject) claim from the token payload
        email: str = payload.get("sub")
        
        # if the token does not contain a subject, treat it as invalid
        if email is None:
            return None
            
        # token is valid and contains an email → return it
        return email
        
    except JWTError:
        return None
# Third-party
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

# Local
from app.database import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, SignUpRequest, Token
from app.schemas.user import UserResponse
from app.utils.security import create_access_token, hash_password, verify_password, verify_token

router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer()

@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(request: SignUpRequest, db: Session = Depends(get_db)):
    """
    Register a new user.
    
    - **email**: Valid email address (must be unique)
    - **password**: Password (min 8 characters)
    - **name**: Optional user name
    - **age**: Optional age (1-150)
    
    Returns the created user (without password).
    """

    # check if the user already exists
    existing_user = db.query(User).filter(User.email == request.email).first()
    # raise error if user exists
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email for this user already exists"
        )
    
    # user does not exist

    # hash the password in payload
    hashed_password = hash_password(request.password)

    # create the new user
    new_user = User(
        email = request.email,
        password_hash = hashed_password,
        name = request.name,
        age = request.age
    )

    # save the user to the database
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user

@router.post("/login", response_model=Token)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Login with email and password.
    
    - **email**: User's email
    - **password**: User's password
    
    Returns a JWT access token.
    """

    # find the user in db
    user = db.query(User).filter(User.email == request.email).first()

    # check if user found
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email"
        )
    
    # check the password
    if not verify_password(request.password, user.password_hash):
         raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password"
        )
    
    # create the JWT token, successful login
    access_token = create_access_token(data={"sub": user.email})

    return Token(access_token=access_token, token_type="bearer")

@router.get("/me", response_model=UserResponse)
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)):
    """
    Get current logged-in user's information.
    
    Requires: Bearer token in Authorization header
    
    Returns the current user's data.
    """

     # get token from Authorization header
    token = credentials.credentials
    
    # verify token and get email
    email = verify_token(token)

    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    # get user from the db
    user = db.query(User).filter(User.email == email).first()

    # check if valid
    if not user:
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
    
    return user

    





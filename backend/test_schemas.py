from app.schemas.auth import SignUpRequest, LoginRequest, Token
from app.schemas.user import UserResponse
from datetime import datetime

print("=== Testing SignupRequest ===")
# Valid signup
signup = SignUpRequest(
    email="test@example.com",
    password="password123",
    name="Test User",
    age=25
)
print(f"✅ Valid signup: {signup.email}")

# Test validation - short password
try:
    invalid_signup = SignUpRequest(
        email="test@example.com",
        password="short"  # Too short!
    )
except Exception as e:
    print(f"✅ Caught short password: {type(e).__name__}")

# Test validation - invalid email
try:
    invalid_email = SignUpRequest(
        email="not-an-email",  # Invalid format!
        password="password123"
    )
except Exception as e:
    print(f"✅ Caught invalid email: {type(e).__name__}")

print("\n=== Testing LoginRequest ===")
login = LoginRequest(
    email="test@example.com",
    password="password123"
)
print(f"✅ Valid login: {login.email}")

print("\n=== Testing Token ===")
token = Token(
    access_token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    token_type="bearer"
)
print(f"✅ Token created: {token.access_token[:50]}...")

print("\n=== Testing UserResponse ===")
user = UserResponse(
    id=1,
    email="test@example.com",
    name="Test User",
    age=25,
    created_at=datetime.now()
)
print(f"✅ User response: {user.email}")
print(f"   - ID: {user.id}")
print(f"   - Name: {user.name}")
print(f"   - Age: {user.age}")

print("\n✅ All schemas working correctly!")
from app.utils.security import hash_password, verify_password, create_access_token, verify_token

# Test 1: Password Hashing
print("=== Testing Password Hashing ===")
password = "mypassword123"
hashed = hash_password(password)
print(f"Original: {password}")
print(f"Hashed: {hashed}")
print()

# Test 2: Password Verification
print("=== Testing Password Verification ===")
is_valid = verify_password("mypassword123", hashed)
print(f"Correct password: {is_valid}")  # Should be True

is_invalid = verify_password("wrongpassword", hashed)
print(f"Wrong password: {is_invalid}")  # Should be False
print()

# Test 3: JWT Token Creation
print("=== Testing JWT Token ===")
token = create_access_token({"sub": "test@example.com"})
print(f"Token created: {token[:50]}...")
print()

# Test 4: JWT Token Verification
print("=== Testing JWT Verification ===")
email = verify_token(token)
print(f"Email from token: {email}")  # Should be test@example.com

invalid_email = verify_token("invalid_token")
print(f"Invalid token: {invalid_email}")  # Should be None


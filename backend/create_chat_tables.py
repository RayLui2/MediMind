from app.database import engine, Base
from app.models.conversations import Conversation
from app.models.message import Message
from app.models.user import User

print("Creating chat tables in Supabase...")
Base.metadata.create_all(bind=engine)
print("✅ Tables created successfully!")
print("   - conversations")
print("   - messages")

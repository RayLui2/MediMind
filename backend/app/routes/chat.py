import json
import os
from assistant.system_prompt import system_prompt
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from assistant.chat import assistant_graph
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.conversations import Conversation
from app.models.message import Message
from app.schemas.chat import (
    MessageCreate, 
    ChatResponse, 
    ConversationResponse, 
    ConversationWithMessages,
    MessageResponse
)
from app.utils.security import verify_token
from app.services.gemini_service import gemini_service
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

router = APIRouter(prefix="/chat", tags=["Chat"])
security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user"""
    token = credentials.credentials
    email = verify_token(token)
    
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    return user


@router.post("/send", response_model=ChatResponse)
def send_message(
    message: MessageCreate,
    conversation_id: int = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send a message and get AI response.
    
    If conversation_id is provided, adds to existing conversation.
    Otherwise, creates a new conversation.
    """
    # Get or create conversation
    if conversation_id:
        conversation = db.query(Conversation).filter(
            Conversation.id == conversation_id,
            Conversation.user_id == user.id
        ).first()
        
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )
    else:
        # Create new conversation
        conversation = Conversation(
            user_id=user.id,
            title=message.content[:50] + "..." if len(message.content) > 50 else message.content
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
    
    # Save user message
    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=message.content
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)
    
    # Get conversation history for context
    previous_messages = db.query(Message).filter(
        Message.conversation_id == conversation.id
    ).order_by(Message.created_at).all()
    
    conversation_history = [
        {"role": msg.role, "content": msg.content}
        for msg in previous_messages[:-1]  # Exclude the message we just added
    ]
    
    # Generate AI response
    ai_response_text = gemini_service.generate_response(
        message.content,
        conversation_history
    )
    
    # Save AI response
    assistant_message = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=ai_response_text
    )
    db.add(assistant_message)
    db.commit()
    db.refresh(assistant_message)
    
    # Update conversation updated_at timestamp
    conversation.updated_at = assistant_message.created_at
    db.commit()
    db.refresh(conversation)
    
    return ChatResponse(
        user_message=user_message,
        assistant_message=assistant_message,
        conversation=conversation
    )

@router.post("/stream")
async def stream_chat_message(
    message: MessageCreate,
    conversation_id: int = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send a message and get streaming AI response.

    If conversation_id is provided, adds to existing conversation.
    Otherwise, creates a new conversation.
    """
    from fastapi.responses import StreamingResponse

    # Get or create conversation
    if conversation_id:
        conversation = db.query(Conversation).filter(
            Conversation.id == conversation_id,
            Conversation.user_id == user.id
        ).first()

        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )
    else:
        # Create new conversation
        conversation = Conversation(
            user_id=user.id,
            title=message.content[:50] + "..." if len(message.content) > 50 else message.content
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

    # Save user message
    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=message.content
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)

    # Get conversation history for context
    previous_messages = db.query(Message).filter(
        Message.conversation_id == conversation.id
    ).order_by(Message.created_at).all()

    conversation_history = [
        {"role": msg.role, "content": msg.content}
        for msg in previous_messages[:-1]  # Exclude the message we just added
    ]

    # Create async generator for SSE format
    async def event_generator():
        full_response = ""

        # Send conversation metadata first
        metadata = {
            "type": "metadata",
            "conversation_id": conversation.id,
            "user_message_id": user_message.id,
            "conversation_title": conversation.title
        }
        yield f"data: {json.dumps(metadata)}\n\n"

        # Prepare messages for LLM
        messages = []

        # Load history from DB
        db_messages = db.query(Message).filter(
            Message.conversation_id == conversation.id
        ).order_by(Message.created_at.desc()).limit(10).all()

        db_messages = list(reversed(db_messages))

        if db_messages:
            for msg in db_messages:
                if msg.role == "user":
                    messages.append(HumanMessage(content=msg.content))
                elif msg.role == "assistant":
                    messages.append(AIMessage(content=msg.content))
        else:
            messages.append(SystemMessage(content=system_prompt))

        # Add user info to current message if available
        if user.name or user.age:
            enhanced_content = f"""
User information:
- Name: {user.name if user.name else 'Unknown'}
- Age: {user.age if user.age else 'Unknown'}

User message:
{message.content}
"""
            messages.append(HumanMessage(content=enhanced_content))
        else:
            messages.append(HumanMessage(content=message.content))

        # Stream directly from LLM (bypass LangGraph for streaming)
        try:
            # Initialize LLM
            from langchain.chat_models import init_chat_model
            llm = init_chat_model(
                os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
                model_provider="google_genai",
                api_key=os.getenv("GEMINI_API_KEY"),
                temperature=0.2,
            )

            # Stream tokens from LLM
            chunk_count = 0
            for chunk in llm.stream(messages):
                if hasattr(chunk, 'content') and chunk.content:
                    token = chunk.content
                    full_response += token
                    chunk_count += 1

                    # Debug: Log chunk info
                    print(f"Chunk {chunk_count}: '{token[:50]}...' (length: {len(token)})")

                    # Yield each token immediately as SSE chunk
                    chunk_data = {"type": "chunk", "text": token}
                    yield f"data: {json.dumps(chunk_data)}\n\n"

            print(f"Total chunks streamed: {chunk_count}")

        except Exception as e:
            print(f"Error in streaming: {str(e)}")
            import traceback
            traceback.print_exc()
            error_data = {"type": "error", "message": str(e)}
            yield f"data: {json.dumps(error_data)}\n\n"
            return

        # Save assistant response
        assistant_message = Message(
            conversation_id=conversation.id,
            role="assistant",
            content=full_response
        )
        db.add(assistant_message)

        if conversation.title == "New Chat":
            conversation.title = message.content[:50]

        db.commit()
        db.refresh(assistant_message)

        # Send completion
        completion_data = {
            "type": "complete",
            "assistant_message_id": assistant_message.id
        }
        yield f"data: {json.dumps(completion_data)}\n\n"
    return StreamingResponse(event_generator(), media_type="text/event-stream")



        # # Stream the AI response chunks
        # try:
        #     for chunk in gemini_service.generate_response_stream(
        #         message.content,
        #         conversation_history
        #     ):
        #         full_response += chunk
        #         data = {"type": "chunk", "text": chunk}
        #         yield f"data: {json.dumps(data)}\n\n"

        #     # Save complete AI response to database
        #     assistant_message = Message(
        #         conversation_id=conversation.id,
        #         role="assistant",
        #         content=full_response
        #     )
        #     db.add(assistant_message)
        #     db.commit()
        #     db.refresh(assistant_message)

        #     # Update conversation updated_at timestamp
        #     conversation.updated_at = assistant_message.created_at
        #     db.commit()

        #     # Send completion event with assistant message ID
        #     completion_data = {
        #         "type": "complete",
        #         "assistant_message_id": assistant_message.id
        #     }
        #     yield f"data: {json.dumps(completion_data)}\n\n"

        # except Exception as e:
        #     error_data = {
        #         "type": "error",
        #         "message": str(e)
        #     }
        #     yield f"data: {json.dumps(error_data)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )



@router.get("/conversations", response_model=List[ConversationResponse])
def get_conversations(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all conversations for current user.
    Ordered by most recent first.
    """
    conversations = db.query(Conversation).filter(
        Conversation.user_id == user.id
    ).order_by(Conversation.updated_at.desc()).all()
    
    return conversations


@router.get("/conversations/{conversation_id}", response_model=ConversationWithMessages)
def get_conversation(
    conversation_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get specific conversation with all messages.
    """
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == user.id
    ).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    return conversation


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a conversation and all its messages.
    """
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == user.id
    ).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    db.delete(conversation)
    db.commit()
    
    return {"message": "Conversation deleted successfully"}
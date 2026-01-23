# Standard library
import asyncio
import json
import os
import traceback
from typing import List

# Third-party
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from langchain.chat_models import init_chat_model
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from sqlalchemy.orm import Session

# Local
from app.database import get_db
from app.models.conversations import Conversation
from app.models.message import Message
from app.models.user import User
from app.schemas.chat import ConversationResponse, ConversationWithMessages, MessageCreate, MessageResponse
from app.services.chat_service import update_instructions
from app.utils.security import verify_token
from assistant.chat import assistant_graph
from assistant.system_prompt import system_prompt

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
            instructions=[]
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

    # Generate title using summarizer for new conversations
    if not conversation_id and conversation.title == "New Chat":  # Only for new conversations
        try:
            # Call summarizer node directly instead of the full graph
            from ..services.chat_service import create_summarizer_node
            summarizer_node = create_summarizer_node()

            # Import State for the summarizer
            from assistant.state import State

            # Create a minimal state with just the message
            state = State(
                messages=[SystemMessage(content=system_prompt), HumanMessage(content=message.content)],
                conversation_title="New Chat"
            )

            # Run summarizer directly
            result = summarizer_node(state)

            # Extract conversation_title from result
            if result.get("conversation_title") and result["conversation_title"] != "New Chat":
                conversation.title = result["conversation_title"]
                db.commit()
                db.refresh(conversation)

        except Exception as e:
            traceback.print_exc()

    # Create async generator for SSE format
    async def event_generator():
        full_response = ""

        # Refresh conversation to get updated title
        db.refresh(conversation)

        # Send conversation metadata first (with updated title)
        metadata = {
            "type": "metadata",
            "conversation_id": conversation.id,
            "user_message_id": user_message.id,
            "instructions": conversation.instructions,
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

        instructions = metadata["instructions"] if metadata["instructions"] else []

        if db_messages:
            messages.append(SystemMessage(content=system_prompt))
            if instructions:
                messages[0] = SystemMessage(content=f"{system_prompt}\nUser instructions:\n{instructions}")
            for msg in db_messages:
                if msg.role == "user":
                    messages.append(HumanMessage(content=msg.content))
                elif msg.role == "assistant":
                    messages.append(AIMessage(content=msg.content))
        else:
            messages.append(SystemMessage(content=f"{system_prompt}\n{instructions}"))

        updated_instructions = update_instructions(messages[-1].content, instructions)
        if instructions != updated_instructions:
            messages[0] = SystemMessage(content=f"{system_prompt}\n{updated_instructions}")
            metadata["instructions"] = updated_instructions

            conversation.instructions = updated_instructions
            db.add(conversation)
            db.commit()
            db.refresh(conversation)

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

                    # Yield each token immediately as SSE chunk
                    chunk_data = {"type": "chunk", "text": token}
                    yield f"data: {json.dumps(chunk_data)}\n\n"

                    # Force async yield to prevent buffering
                    await asyncio.sleep(0)

        except Exception as e:
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
        db.commit()
        db.refresh(assistant_message)

        # Send completion
        completion_data = {
            "type": "complete",
            "assistant_message_id": assistant_message.id,
            "conversation_id": conversation.id,
            "conversation_title": conversation.title
        }
        yield f"data: {json.dumps(completion_data)}\n\n"
    return StreamingResponse(
        event_generator(), 
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
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
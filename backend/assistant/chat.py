# Standard library imports
import os
from typing import Dict, Any, Generator

# Third-party imports
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langgraph.graph import END, StateGraph
from langgraph.checkpoint.postgres import PostgresSaver

# Local imports
from assistant.models.chat import ChatMessage
from assistant.nodes.chatbot import create_chatbot_node
from assistant.nodes.summarizer import create_summarizer_node
from assistant.state import State
from assistant.system_prompt import system_prompt
from app.models.conversations import Conversation

# Database imports
from app.database import get_db
from app.models.message import Message

# --- Create Graph ---
assistant_graph_builder = StateGraph(State)

# --- Create Nodes ---
chatbot_node = create_chatbot_node()
summarizer_node = create_summarizer_node()

# --- Add Nodes ---
assistant_graph_builder.add_node("chatbot", chatbot_node)
assistant_graph_builder.add_node("summarizer", summarizer_node)

# --- Set Entry Point ---
assistant_graph_builder.set_entry_point("summarizer")

# --- Add Edges ---
# Summarizer always goes to chatbot after generating summary
assistant_graph_builder.add_edge("summarizer", "chatbot")

# Chatbot goes to END
assistant_graph_builder.add_edge("chatbot", END)


### Currently not used - might be used in the future ###
def call_assistant(assistant_graph: StateGraph, conversation: Conversation, user_msg: str, db) -> Generator[Dict[str, Any], None, None]:
    if not user_msg:
        raise ValueError("User message is required.")

    config = {"configurable": {"thread_id": f"conversation_{conversation.id}"}}
    
    # Get checkpoint state
    checkpoint_state = assistant_graph.get_state(config)

    messages = []

    # # Inject the chat history if the conversation is new
    # Check if checkpoint exists AND has messages
    if not checkpoint_state.values or not checkpoint_state.values.get("messages"):
        # No checkpoint found - need to initialize from database
        
        # Load messages from database
        db_messages = db.query(Message).filter(
            Message.conversation_id == conversation.id
        ).order_by(Message.created_at.desc()).limit(10).all()

        db_messages = list(reversed(db_messages))
        
        if db_messages:
            # Convert DB messages to LangChain messages
            for msg in db_messages:
                if msg.role == "user":
                    messages.append(HumanMessage(content=msg.content))
                elif msg.role == "assistant":
                    messages.append(AIMessage(content=msg.content))
        else:
            # Truly new conversation - add system prompt
            messages.append(SystemMessage(content=system_prompt))

    # Add the user message
    messages.append(HumanMessage(user_msg))

    # Add the chat history
    chat_history = [ChatMessage(role="user", content=user_msg)]

    for chunk in assistant_graph.stream({
        "messages": messages,
        "chat_history": chat_history,
    }, config=config):
        yield chunk

load_dotenv()
# Create checkpointer - PostgresSaver.from_conn_string returns a sync checkpointer
with PostgresSaver.from_conn_string(os.getenv("DATABASE_URL")) as checkpointer:
    checkpointer.setup()  # Create tables if they don't exist

# Compile without checkpointer for now (will add async checkpointer later)
assistant_graph = assistant_graph_builder.compile()
# backend/test_assistant_with_checkpoint.py
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage
from assistant.graph import assistant_graph

load_dotenv()

def test_with_checkpoint():
    """Test with checkpointing to see conversation persistence"""
    
    thread_id = "test_conversation_123"
    config = {"configurable": {"thread_id": thread_id}}
    
    # First message
    print("=== First Message ===")
    initial_state = {
        "messages": [
            HumanMessage(content="What causes headaches?")
        ],
        "chat_history": [],
    }
    
    print("User: What causes headaches?\n")
    
    for chunk in assistant_graph.stream(initial_state, config=config):
        if "chatbot" in chunk:
            messages = chunk["chatbot"].get("messages", [])
            if messages:
                print(f"Assistant: {messages[-1].content}\n")
    
    # Second message (should remember context)
    print("\n=== Second Message (Testing Memory) ===")
    followup_state = {
        "messages": [
            HumanMessage(content="What can I do to prevent them?")
        ],
        "chat_history": [],
    }
    
    print("User: What can I do to prevent them?\n")
    
    for chunk in assistant_graph.stream(followup_state, config=config):
        if "chatbot" in chunk:
            messages = chunk["chatbot"].get("messages", [])
            if messages:
                print(f"Assistant: {messages[-1].content}\n")
    
    print("\n✅ Test completed!")

if __name__ == "__main__":
    test_with_checkpoint()
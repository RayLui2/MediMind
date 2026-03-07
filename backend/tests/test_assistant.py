# backend/test_assistant.py
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage
from assistant.graph import assistant_graph

load_dotenv()

def test_simple_message():
    """Test a simple message without database or checkpointing"""
    
    # Create initial state with system message and user message
    initial_state = {
        "messages": [
            HumanMessage(content="What is a headache?")
        ],
        "chat_history": [],
    }
    
    print("Testing assistant with simple message...")
    print("User: What is a headache?\n")
    
    # Stream the response
    for chunk in assistant_graph.stream(initial_state):
        print(f"Chunk: {chunk}")
    
    print("\n✅ Test completed!")

if __name__ == "__main__":
    test_simple_message()
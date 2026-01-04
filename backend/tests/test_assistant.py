# backend/test_assistant.py

import os
import sys
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from os.path import dirname, join
from assistant.chat import assistant_graph
from assistant.system_prompt import system_prompt

load_dotenv()

def test_simple_message():
    """Test a simple message without database or checkpointing"""
    
    # Create initial state with system message and user message
    initial_state = {
        "messages": [
            SystemMessage(content=system_prompt),
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
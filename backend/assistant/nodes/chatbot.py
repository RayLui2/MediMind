from assistant.state import State
from langchain.chat_models import init_chat_model
import os
from langchain_core.messages import HumanMessage
from assistant.models.chat import ChatMessage
from assistant.system_prompt import system_prompt
from dotenv import load_dotenv
load_dotenv()

def create_chatbot_node():
    """
    Create a chatbot node that can be used in a LangGraph graph.
    """

    llm = init_chat_model(
        os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        model_provider="google_genai",
        api_key=os.getenv("GEMINI_API_KEY"),
        temperature=0.2,
    )

    def chatbot_node(state: State):
        messages = list(state.messages)

        if state.user_data and len(messages) > 0 and isinstance(messages[-1], HumanMessage):
            original_content = messages[-1].content
            enhanced_content = HumanMessage(content=f"""
User information:
- Name: {state.user_data.get('name', 'Unknown')}
- Age: {state.user_data.get('age', 'Unknown')}

User message:\n{original_content}
""")

            messages[-1] = enhanced_content

        response = llm.invoke(messages)

        return {"messages": [response], "chat_history": [ChatMessage(role="assistant", content=response.content)]}

    return chatbot_node
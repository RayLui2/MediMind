from google import genai
import os
from dotenv import load_dotenv

load_dotenv()

class GeminiService:
    def __init__(self):
        self.client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        self.model = 'gemini-2.5-flash'

    def generate_response(self, message: str, conversation_history: list = None) -> str:
        """
        Generate AI response to user message.
        
        Args:
            message: User's message
            conversation_history: List of previous messages for context
                                 Format: [{"role": "user", "content": "..."}, ...]
        
        Returns:
            AI's response text
        """

        try:
            if conversation_history:
                context = self.format_conversation_history(conversation_history)
                full_message = f"{context}\n\nUser: {message}"
            else:
                full_message = message
            
            # Add system message for health context
            system_context = """You are MediMind, a helpful AI health assistant. 
You provide general health information and advice, but always remind users 
that you are not a replacement for professional medical care. Be empathetic, 
clear, and helpful while being medically responsible."""
            
            full_prompt = f"{system_context}\n\n{full_message}"
            
            # Generate response
            response = self.client.models.generate_content(
                model=self.model,
                contents=full_prompt
            )
            
            return response.text
            
        except Exception as e:
            print(f"Gemini API error: {e}")
            return "I'm sorry, I'm having trouble responding right now. Please try again."
        
    def format_conversation_history(self, history: list) -> str:
        """Format conversation history for context."""
        formatted = []
        for msg in history[-10:]:  # Only use last 10 messages for context
            role = "User" if msg["role"] == "user" else "Assistant"
            formatted.append(f"{role}: {msg['content']}")
        return "\n".join(formatted)

# Create singleton instance
gemini_service = GeminiService()
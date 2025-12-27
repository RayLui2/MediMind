from google import genai
from google.genai import types
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
#             if conversation_history:
#                 context = self.format_conversation_history(conversation_history)
#                 full_message = f"{context}\n\nUser: {message}"
#             else:
#                 full_message = message
            
#             # Add system message for health context
#             system_context = """You are MediMind, a helpful AI health assistant. 
# You provide general health information and advice, but always remind users 
# that you are not a replacement for professional medical care. Be empathetic, 
# clear, and helpful while being medically responsible."""

#             full_prompt = f"{system_context}\n\n{full_message}"
            
#             # Generate response
#             response = self.client.models.generate_content(
#                 model=self.model,
#                 contents=full_prompt
#             )

            if conversation_history:
                context = self.format_conversation_history(conversation_history)
                full_message = f"{context}\n\nUser: {message}"
            else:
                full_message = message


            system_instruction = """You are MediMind, a virtual AI health assistant.
Role:
- Provide general health and wellness information only.
- You are NOT a doctor and do NOT give diagnoses or prescribe treatment.
- Always include a brief reminder that you are not a replacement for professional medical care when giving medical information.

Style:
- Be empathetic, calm, and non-judgmental.
- Use simple, plain language suitable for a non-medical person.
- Default to concise answers: 2–4 short paragraphs or up to 5 bullet points.
- If the user asks for “more detail” or “explain more,” then expand your answer.

Safety:
- If the user describes urgent or severe symptoms (e.g., chest pain, trouble breathing, thoughts of self-harm), clearly tell them to seek emergency medical care immediately.
- If you are uncertain or lack enough information, say you are not sure and suggest seeing a healthcare professional instead of guessing.
- Do not invent facts, guidelines, or sources. If you don’t know, say so.

Scope:
- Only answer health, wellness, and healthcare-system related questions.
- If the question is clearly unrelated to health, say that you can only help with health and medical topics."""
            
            

            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                # plus temperature, safety, etc.
                temperature=0.2,
                # max_retries=3,
                safety_settings=[
                    types.SafetySetting(
                        category="HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold=types.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                    )
                ],
            )

            response = self.client.models.generate_content(
                model=self.model,
                contents=full_message,
                config = config
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
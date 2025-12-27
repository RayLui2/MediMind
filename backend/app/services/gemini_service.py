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
            
            safety_settings = [
                types.SafetySetting(
                    category="HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold=types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_HATE_SPEECH",
                    threshold=types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_HARASSMENT",
                    threshold=types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold=types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                ),
            ]

            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                # temperature, safety, etc.
                temperature=0.2,
                max_output_tokens=1024,
                safety_settings=safety_settings,
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
        
    def generate_response_stream(self, message: str, conversation_history: list = None):
        """
        Generator that yields response chunks as they arrive.
        
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
            
            safety_settings = [
                types.SafetySetting(
                    category="HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold=types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_HATE_SPEECH",
                    threshold=types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_HARASSMENT",
                    threshold=types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold=types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                ),
            ]

            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                # temperature, safety, etc.
                temperature=0.2,
                max_output_tokens=1024,
                safety_settings=safety_settings,
            )

            response = self.client.models.generate_content_stream(
                model=self.model,
                contents=full_message,
                config = config
            )
            
            # Yield each chunk
            for chunk in response:
                yield chunk.text
            
        except Exception as e:
            print(f"Gemini API error: {e}")
            return "I'm sorry, I'm having trouble responding right now. Please try again."


    def format_conversation_history(self, history: list) -> str:
        """Format conversation history for context."""
        formatted = []
        for msg in history[-10:]:  # Only use last 10 messages for context
            role = "User" if msg["role"] == "user" else "Assistant"
            formatted.append(f"[{role}]: {msg['content']}\n")
        return "\n".join(formatted)

# Create singleton instance
gemini_service = GeminiService()
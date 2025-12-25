from google import genai
import os
from dotenv import load_dotenv

load_dotenv()

# Create client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Test with gemini-2.5-flash (latest stable free model)
response = client.models.generate_content(
    model='gemini-2.5-flash',
    contents='Hello! Can you help me with health questions?'
)

print("Gemini Response:")
print(response.text)

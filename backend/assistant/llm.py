# Standard library
import os

# Third-party
from dotenv import load_dotenv
from langchain.chat_models import init_chat_model

# Load environment (GEMINI_API_KEY / GEMINI_MODEL) once at import. Node modules
# import this factory, so this runs before any node builds its LLM — which is
# why graph.py / the nodes no longer need their own load_dotenv() calls.
load_dotenv()


def get_llm(temperature: float, **kwargs):
    """
    Build the Gemini chat model for a graph node.

    The per-node temperatures are deliberate and must NOT be flattened:
      ~0.05 classifier (triage) / 0.2 generation & critique (chatbot, critic)
      / 0.3 titles (summarizer) / 0.5 recommendations.
    Pass any extra init_chat_model kwargs (e.g. streaming=True) via **kwargs.
    """
    return init_chat_model(
        os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        model_provider="google_genai",
        api_key=os.getenv("GEMINI_API_KEY"),
        temperature=temperature,
        **kwargs,
    )

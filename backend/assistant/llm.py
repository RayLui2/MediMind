# Standard library
import os

# Third-party
from dotenv import load_dotenv
from langchain.chat_models import init_chat_model

# Load environment (GEMINI_API_KEY / GEMINI_MODEL) once at import. Node modules
# import this factory, so this runs before any node builds its LLM — which is
# why graph.py / the nodes no longer need their own load_dotenv() calls.
load_dotenv()


def get_llm(temperature: float, tier: str = "standard", **kwargs):
    """
    Build the Gemini chat model for a graph node.

    The per-node temperatures are deliberate and must NOT be flattened:
      ~0.05 classifier (triage) / 0.2 generation & critique (chatbot, critic)
      / 0.3 titles (summarizer) / 0.5 recommendations.

    tier="fast" routes cheap classification/labeling nodes (triage, summarizer)
    to the lite model (review §4.3): lower latency on the critical path and a
    separate free-tier quota, which matters — flash's free tier is 5 req/min,
    20 req/day. Safety-validated before adoption: 97% accuracy, 7/7 emergency
    recall, 0 over-escalations on evals/run_triage_eval.py (2026-07-14). The
    critic and chatbot must stay on the standard tier.
    Pass any extra init_chat_model kwargs (e.g. streaming=True) via **kwargs.
    """
    if tier == "fast":
        model = os.getenv("GEMINI_MODEL_FAST", "gemini-3.1-flash-lite")
    else:
        model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    return init_chat_model(
        model,
        model_provider="google_genai",
        api_key=os.getenv("GEMINI_API_KEY"),
        temperature=temperature,
        **kwargs,
    )

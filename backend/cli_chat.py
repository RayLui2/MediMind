#!/usr/bin/env python3
"""
Terminal chat interface for the MediMind assistant.

Run from the backend directory:
    python cli_chat.py

Optional env vars (loaded from .env automatically):
    GEMINI_API_KEY, GEMINI_MODEL
"""

import asyncio
import logging
import os
import sys

# Ensure backend/ is on the path so `assistant.*` imports resolve
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from langchain_core.messages import AIMessage, HumanMessage

from assistant.graph import compile_graph, create_assistant_graph

# Dev harness: node/service decisions log via module loggers; configure the root
# logger so those stay visible when running the CLI directly.
logging.basicConfig(level=logging.INFO)

CLI_CONVERSATION_ID = 0  # int so State validation passes


async def chat() -> None:
    print("MediMind Assistant — Terminal Chat")
    print("Type 'quit' or 'exit' to stop.\n")

    graph = compile_graph(create_assistant_graph())
    messages: list = []

    while True:
        try:
            user_input = input("You: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nBye!")
            break

        if not user_input:
            continue
        if user_input.lower() in ("quit", "exit"):
            print("Bye!")
            break

        messages.append(HumanMessage(content=user_input))

        state_dict = {
            "messages": messages,
            "conversation_id": CLI_CONVERSATION_ID,
        }

        print("Assistant: ", end="", flush=True)

        # Same delivery policy as AssistantService.stream_chat: print tokens
        # live only when triage bypassed the critic (general/off_topic);
        # otherwise print the whole approved answer once the commit node runs.
        live = False
        full_response = ""

        async for event in graph.astream_events(state_dict, version="v2"):
            kind = event.get("event")
            name = event.get("name", "")
            node = event.get("metadata", {}).get("langgraph_node", "")

            if kind == "on_chain_end" and name == "triage":
                output = event.get("data", {}).get("output") or {}
                if isinstance(output, dict):
                    live = bool(output.get("critic_approved"))

            elif kind == "on_chat_model_stream" and node == "chatbot" and live:
                chunk = event.get("data", {}).get("chunk")
                if chunk is not None and isinstance(chunk.content, str) and chunk.content:
                    print(chunk.content, end="", flush=True)

            elif kind == "on_chain_end" and name == "streaming":
                output = event.get("data", {}).get("output") or {}
                msgs = output.get("messages") if isinstance(output, dict) else None
                if msgs:
                    full_response = msgs[-1].content
                    if not live:
                        print(full_response, end="", flush=True)

        print()  # newline after the response

        if full_response:
            messages.append(AIMessage(content=full_response))


if __name__ == "__main__":
    asyncio.run(chat())

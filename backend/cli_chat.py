#!/usr/bin/env python3
"""
Terminal chat interface for the MediMind assistant.

Run from the backend directory:
    python cli_chat.py

Optional env vars (loaded from .env automatically):
    GEMINI_API_KEY, GEMINI_MODEL
"""

import asyncio
import os
import sys

# Ensure backend/ is on the path so `assistant.*` imports resolve
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from langchain_core.messages import AIMessage, HumanMessage

from assistant.graph import compile_graph, create_assistant_graph
from assistant.nodes.streaming import cleanup_streaming_queue, get_streaming_queue

CLI_CONVERSATION_ID = 0  # int so State validation passes; streaming key becomes "0"


async def chat() -> None:
    print("MediMind Assistant — Terminal Chat")
    print("Type 'quit' or 'exit' to stop.\n")

    graph = compile_graph(create_assistant_graph())
    messages: list = []
    turn = 0

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
        turn += 1

        state_dict = {
            "messages": messages,
            "conversation_id": CLI_CONVERSATION_ID,
        }
        config = {"configurable": {"thread_id": f"cli_{turn}"}}

        # Set up streaming queue before launching graph
        queue = get_streaming_queue(str(CLI_CONVERSATION_ID))

        print("Assistant: ", end="", flush=True)

        full_response = ""

        async def run_graph() -> None:
            await graph.ainvoke(state_dict, config=config)

        graph_task = asyncio.create_task(run_graph())

        # Consume tokens from queue as the streaming node emits them
        done = False
        while not done:
            try:
                item = await asyncio.wait_for(queue.get(), timeout=120.0)
                if item["type"] == "token":
                    print(item["text"], end="", flush=True)
                    full_response += item["text"]
                elif item["type"] == "end":
                    done = True
            except asyncio.TimeoutError:
                if graph_task.done():
                    done = True
                else:
                    print("\n[timeout waiting for response]")
                    graph_task.cancel()
                    break

        await graph_task
        cleanup_streaming_queue(str(CLI_CONVERSATION_ID))

        print()  # newline after streamed response

        if full_response:
            messages.append(AIMessage(content=full_response.strip()))


if __name__ == "__main__":
    asyncio.run(chat())

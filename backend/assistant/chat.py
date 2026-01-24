# Standard library imports
import os

# Third-party imports
from dotenv import load_dotenv
from langgraph.graph import END, StateGraph

# Local imports
from assistant.nodes.chatbot import create_chatbot_node
from assistant.nodes.summarizer import create_summarizer_node
from assistant.state import State

load_dotenv()


def create_assistant_graph() -> StateGraph:
    """
    Create and configure the LangGraph assistant graph.

    Graph Structure:
    [fanout] → [summarizer] → [END]
       ↓
    [chatbot] → [END]

    The summarizer and chatbot run in parallel:
    - Summarizer generates conversation title (for new conversations)
    - Chatbot generates the AI response

    Returns:
        StateGraph builder (not yet compiled)
    """
    graph_builder = StateGraph(State)

    # Create nodes
    chatbot_node = create_chatbot_node()
    summarizer_node = create_summarizer_node()

    def fanout_node(state: State):
        """Pass-through node that triggers parallel execution"""
        return state

    # Add nodes
    graph_builder.add_node("fanout", fanout_node)
    graph_builder.add_node("chatbot", chatbot_node)
    graph_builder.add_node("summarizer", summarizer_node)

    # Set entry point
    graph_builder.set_entry_point("fanout")

    # Add edges - fanout branches to both nodes in parallel
    graph_builder.add_edge("fanout", "summarizer")
    graph_builder.add_edge("fanout", "chatbot")

    # Both nodes end independently
    graph_builder.add_edge("summarizer", END)
    graph_builder.add_edge("chatbot", END)

    return graph_builder


def compile_graph(graph_builder: StateGraph, checkpointer=None):
    """
    Compile the graph with optional checkpointer.

    Args:
        graph_builder: The StateGraph builder
        checkpointer: Optional checkpointer for conversation persistence

    Returns:
        Compiled graph
    """
    if checkpointer:
        return graph_builder.compile(checkpointer=checkpointer)
    return graph_builder.compile()


# Create and compile the default graph
assistant_graph_builder = create_assistant_graph()
assistant_graph = compile_graph(assistant_graph_builder)

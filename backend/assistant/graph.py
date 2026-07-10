# Standard library imports
import os

# Third-party imports
from dotenv import load_dotenv
from langgraph.graph import END, StateGraph

# Local imports
from assistant.state import State
from assistant.nodes.triage import create_triage_node
from assistant.nodes.chatbot import create_chatbot_node
from assistant.nodes.context_builder import create_context_builder_node
from assistant.nodes.critic import create_critic_node
from assistant.nodes.streaming import create_streaming_node
from assistant.nodes.summarizer import create_summarizer_node

load_dotenv()


def create_assistant_graph() -> StateGraph:
    """
    Create and configure the LangGraph assistant graph.

    Graph Structure:
    [fanout] → [summarizer] → [END]
       ↓
    [triage] → [context_builder] → [chatbot] → [critic]* → [END | chatbot (loop)]
    * skipped straight to streaming when triage already set critic_approved (general/off_topic)

    The summarizer, triage run in parallel:
    - Summarizer generates conversation title (for new conversations)
    - Triage determines the topic of the user's message
    - Context builder retrieves relevant context for the triage topic
    - Chatbot generates the AI response based on the context and the user's message
    - If triage already approved the message (general/off_topic), chatbot routes straight to streaming, skipping critic.
    - Otherwise, critic evaluates the response and decides if it is critical or not. If it is critical, go to the chatbot node from the critic node, otherwise go to the streaming node.

    Returns:
        StateGraph builder (not yet compiled)
    """
    def route_chatbot(state: State):
        if state.critic_approved or state.revision_count >= 2:
            return "streaming"
        return "chatbot"

    def route_critic(state: State):
        if state.critic_approved:
            return "streaming"
        return "critic"
    
    workflow = StateGraph(State)

    # Create nodes
    triage_node = create_triage_node()
    context_builder_node = create_context_builder_node()
    chatbot_node = create_chatbot_node()
    critic_node = create_critic_node()
    streaming_node = create_streaming_node()
    summarizer_node = create_summarizer_node()

    def fanout_node(state: State):
        """Pass-through node that triggers parallel execution. Reset critic loop state per turn."""
        return {"critic_approved": False, "revision_count": 0}

    # Add nodes
    workflow.add_node("fanout", fanout_node)
    workflow.add_node("triage", triage_node)
    workflow.add_node("context_builder", context_builder_node)
    workflow.add_node("critic", critic_node)
    workflow.add_node("chatbot", chatbot_node)
    workflow.add_node("streaming", streaming_node)
    workflow.add_node("summarizer", summarizer_node)

    # Set entry point
    workflow.set_entry_point("fanout")

    # Add edges - fanout branches to both nodes in parallel
    workflow.add_edge("fanout", "summarizer")
    workflow.add_edge("fanout", "triage")

    # Add edge - triage to chatbot
    workflow.add_edge("triage", "context_builder")
    workflow.add_edge("context_builder", "chatbot")

    # Skip critic if triage already approved (general/off_topic)
    workflow.add_conditional_edges(
        "chatbot",
        route_critic,
        {
            "streaming": "streaming",
            "critic": "critic"
        }
    )
    
    # Both nodes end independently
    workflow.add_conditional_edges(
        "critic",
        route_chatbot,
        {
            "chatbot": "chatbot",
            "streaming": "streaming"
        } 
    )
    workflow.add_edge("streaming", END)
    workflow.add_edge("summarizer", END)

    return workflow


def compile_graph(graph_builder: StateGraph):
    """
    Compile the graph.

    Args:
        graph_builder: The StateGraph builder

    Returns:
        Compiled graph
    """
    return graph_builder.compile()


# Create and compile the default graph
assistant_graph_builder = create_assistant_graph()
assistant_graph = compile_graph(assistant_graph_builder)

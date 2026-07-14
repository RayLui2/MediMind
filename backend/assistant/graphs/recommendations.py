# Standard library imports
import os
from typing import Optional, List, Any

# Third-party imports
from langgraph.graph import END, StateGraph
from pydantic import BaseModel
from sqlalchemy.orm import Session

# Local
from assistant.nodes.recommendations import create_recommendations_node
from assistant.models.health_profile import HealthProfile
from assistant.models.vital_sign import VitalSign


class RecommendationsState(BaseModel):
    """State for recommendations graph"""
    user_id: int
    health_profile: Optional[HealthProfile] = None
    vital_signs: Optional[VitalSign] = None
    recommendations: List[Any] = []

    class Config:
        arbitrary_types_allowed = True


def create_recommendations_graph(db: Session):
    """
    Create a LangGraph for generating health recommendations.

    This is a simple single-node graph that:
    1. Takes user health data as input
    2. Generates personalized recommendations
    3. Persists them to the database

    Args:
        db: Database session for the recommendations node

    Returns:
        Compiled StateGraph
    """
    graph_builder = StateGraph(RecommendationsState)

    # Create the recommendations node with DB access
    recommendations_node = create_recommendations_node(db)

    # Add nodes
    graph_builder.add_node("generate_recommendations", recommendations_node)

    # Set entry and edges
    graph_builder.set_entry_point("generate_recommendations")
    graph_builder.add_edge("generate_recommendations", END)

    return graph_builder.compile()


# Note: Unlike the chat graph, we don't pre-compile this graph
# because it needs a DB session which is request-scoped.
# Use create_recommendations_graph(db) in your route/service.

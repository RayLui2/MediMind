from pydantic import BaseModel, Field
from typing import Optional


class CriticResult(BaseModel):
    """Safety and accuracy evaluation of the assistant's draft response"""

    approved: bool = Field(
        description="True if the response is safe, accurate, and appropriate given the user's health context. False if it needs revision."
    )
    critique: Optional[str] = Field(
        default=None,
        description="Only set when approved is False. One sentence describing the specific problem and exactly what needs to be fixed, e.g. 'Response suggests ibuprofen but user is on Warfarin — flag the bleeding risk interaction.'"
    )

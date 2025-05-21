from typing import Union, Literal, Optional
from pydantic import BaseModel

class NormalResponse(BaseModel):
    type: Literal["normal"] = "normal"
    text: str
    # Potentially other metadata like suggested_follow_ups, etc.

class ConfirmSwitchAgentResponse(BaseModel):
    type: Literal["confirm_switch_agent"] = "confirm_switch_agent"
    confirmation_prompt_to_user: str
    potential_new_agent_id: str
    original_user_message: str # Needed to pass to the new agent or back to the current one

# Agents will now return one of these response types
AgentOutput = Union[NormalResponse, ConfirmSwitchAgentResponse] 
from pydantic import BaseModel, Field
from typing import List, Literal, Optional, Dict, Any

Role = Literal["system", "user", "assistant", "tool"]

class Message(BaseModel):
    role: Role
    content: str
    toolName: Optional[str] = None

class TurnOverrides(BaseModel):
    model: Optional[str] = None
    temperature: Optional[float] = None
    extra: Dict[str, Any] = {}

class TurnReq(BaseModel):
    engine: Literal["openai", "claude", "dummy"] = "dummy"
    model: Optional[str] = None
    personalityId: Optional[str] = None
    messages: List[Message] = Field(default_factory=list)
    overrides: Optional[TurnOverrides] = None

class Usage(BaseModel):
    inputTokens: int = 0
    outputTokens: int = 0
    costUSD: Optional[float] = None

class TurnResp(BaseModel):
    output: Message
    usage: Usage = Usage()
    trace: Dict[str, Any] = {}

"""
Base LLM client interface and deterministic mock client for testing.
"""

from abc import ABC, abstractmethod
from typing import Optional


class BaseLLMClient(ABC):
    """Abstract base class for LLM completion clients."""

    @abstractmethod
    def generate(self, prompt: str) -> str:
        """Generate response string from prompt."""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Check if LLM service is available."""
        pass


class MockLLMClient(BaseLLMClient):
    """Deterministic mock client for testing without external models."""

    def __init__(
        self,
        response: str = "{}",
        available: bool = True,
        exception: Optional[Exception] = None,
        enabled: bool = True,
    ) -> None:
        self._response = response
        self._available = available
        self._exception = exception
        self.enabled = enabled
        self._last_prompt: Optional[str] = None

    def is_available(self) -> bool:
        """Return configured availability status."""
        return self.enabled and self._available

    def generate(self, prompt: str) -> str:
        """Store received prompt and return configured response or raise exception."""
        self._last_prompt = prompt
        if self._exception is not None:
            raise self._exception
        return self._response

    @property
    def last_prompt(self) -> Optional[str]:
        """Return the last prompt passed to generate()."""
        return self._last_prompt

"""Lazy, CPU-only llama.cpp client for local GGUF inference."""

import importlib.util
import os
import threading
from typing import Any, Optional

from app.core.exceptions import (
    LLMClientDisabledError,
    LLMDependencyError,
    LLMGenerationError,
    LLMModelLoadError,
)
from app.llm.base_client import BaseLLMClient


class LlamaCppLLMClient(BaseLLMClient):
    """Generate Qwen chat completions from one local GGUF model."""

    def __init__(
        self,
        model_path: str,
        *,
        enabled: bool = False,
        n_threads: int = 4,
        n_ctx: int = 1024,
        max_tokens: int = 256,
        temperature: float = 0.0,
        top_p: float = 0.9,
        repeat_penalty: float = 1.1,
    ) -> None:
        if not isinstance(model_path, str) or not model_path.strip():
            raise ValueError("model_path must be a non-empty string.")
        if isinstance(n_threads, bool) or not isinstance(n_threads, int) or n_threads <= 0:
            raise ValueError("n_threads must be an integer greater than 0.")
        if isinstance(n_ctx, bool) or not isinstance(n_ctx, int) or n_ctx <= 0:
            raise ValueError("n_ctx must be an integer greater than 0.")
        if isinstance(max_tokens, bool) or not isinstance(max_tokens, int) or max_tokens <= 0:
            raise ValueError("max_tokens must be an integer greater than 0.")
        if temperature < 0:
            raise ValueError("temperature must be non-negative.")

        self.model_path = os.path.abspath(os.path.expanduser(model_path.strip()))
        self.enabled = enabled
        self.n_threads = n_threads
        self.n_ctx = n_ctx
        self.max_tokens = max_tokens
        self.temperature = float(temperature)
        self.top_p = float(top_p)
        self.repeat_penalty = float(repeat_penalty)

        self._model: Any = None
        self._is_loaded = False
        self._load_error: Optional[Exception] = None
        self._last_prompt: Optional[str] = None
        self._load_lock = threading.RLock()
        self._generate_lock = threading.RLock()

    @property
    def is_loaded(self) -> bool:
        return self._is_loaded

    @property
    def load_error(self) -> Optional[Exception]:
        return self._load_error

    @property
    def last_prompt(self) -> Optional[str]:
        return self._last_prompt

    def is_available(self) -> bool:
        """Check dependency and file presence without loading model weights."""
        if not self.enabled or self._load_error is not None:
            return False
        if self._is_loaded:
            return True
        return os.path.isfile(self.model_path) and importlib.util.find_spec("llama_cpp") is not None

    def load(self) -> None:
        """Load the GGUF once for this client instance."""
        if not self.enabled:
            raise LLMClientDisabledError("LLM client is disabled.")
        if self._is_loaded:
            return

        with self._load_lock:
            if self._is_loaded:
                return
            if self._load_error is not None:
                raise self._load_error
            try:
                if not os.path.isfile(self.model_path):
                    raise LLMModelLoadError("Configured GGUF model file does not exist.")
                if importlib.util.find_spec("llama_cpp") is None:
                    raise LLMDependencyError("Required dependency 'llama-cpp-python' is not installed.")
                from llama_cpp import Llama

                self._model = Llama(
                    model_path=self.model_path,
                    n_ctx=self.n_ctx,
                    n_threads=self.n_threads,
                    n_threads_batch=self.n_threads,
                    n_gpu_layers=0,
                    verbose=False,
                )
                self._is_loaded = True
            except (LLMDependencyError, LLMModelLoadError) as exc:
                self._load_error = exc
                self._model = None
                self._is_loaded = False
                raise
            except Exception as exc:
                wrapped = LLMModelLoadError(
                    f"Failed to load GGUF model: {type(exc).__name__}"
                )
                self._load_error = wrapped
                self._model = None
                self._is_loaded = False
                raise wrapped from exc

    def generate(self, prompt: str) -> str:
        """Return one serialized Qwen chat response."""
        if not isinstance(prompt, str) or not prompt.strip():
            raise ValueError("prompt must be a non-empty string.")
        if not self.enabled:
            raise LLMClientDisabledError("LLM client is disabled.")
        self._last_prompt = prompt
        if not self._is_loaded:
            self.load()

        with self._generate_lock:
            try:
                response = self._model.create_chat_completion(
                    messages=[{"role": "user", "content": prompt}],
                    temperature=self.temperature,
                    top_p=self.top_p,
                    repeat_penalty=self.repeat_penalty,
                    max_tokens=self.max_tokens,
                    response_format={"type": "json_object"},
                    stop=["<|im_end|>", "<|endoftext|>"],
                )
                text = response["choices"][0]["message"]["content"]
                if not isinstance(text, str) or not text.strip():
                    raise ValueError("llama.cpp returned an empty completion")
                return text.strip()
            except LLMGenerationError:
                raise
            except Exception as exc:
                raise LLMGenerationError(
                    f"Error during llama.cpp generation: {type(exc).__name__}"
                ) from exc

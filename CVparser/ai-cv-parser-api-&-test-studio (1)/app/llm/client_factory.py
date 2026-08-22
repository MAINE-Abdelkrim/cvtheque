"""
Factory module for creating LLM clients based on application settings.
"""

from functools import lru_cache
from typing import Optional

from app.core.config import Settings, get_settings
from app.llm.base_client import BaseLLMClient
from app.llm.llama_cpp_client import LlamaCppLLMClient
from app.llm.qwen_client import QwenLLMClient


@lru_cache(maxsize=8)
def _create_cached_client(
    provider: str,
    model_name: str,
    gguf_path: str,
    local_files_only: bool,
    device: str,
    torch_dtype: str,
    max_new_tokens: int,
    do_sample: bool,
    temperature: float,
    top_p: float,
    repetition_penalty: float,
    trust_remote_code: bool,
    n_threads: int,
    context_size: int,
) -> BaseLLMClient:
    """Create one lazy client per process and effective configuration."""
    if provider == "llama_cpp":
        return LlamaCppLLMClient(
            model_path=gguf_path,
            enabled=True,
            n_threads=n_threads,
            n_ctx=context_size,
            max_tokens=max_new_tokens,
            temperature=temperature,
            top_p=top_p,
            repeat_penalty=repetition_penalty,
        )
    if provider == "pytorch":
        return QwenLLMClient(
            model_name_or_path=model_name,
            enabled=True,
            local_files_only=local_files_only,
            device=device,
            torch_dtype=torch_dtype,
            max_new_tokens=max_new_tokens,
            do_sample=do_sample,
            temperature=temperature,
            top_p=top_p,
            repetition_penalty=repetition_penalty,
            trust_remote_code=trust_remote_code,
        )
    raise ValueError("MODEL_PROVIDER must be 'pytorch' or 'llama_cpp'.")


def create_llm_client(settings: Optional[Settings] = None) -> Optional[BaseLLMClient]:
    """Factory function returning a configured LLM client or None if disabled.

    Guarantees:
    - Returns None when MODEL_ENABLED is False.
    - Instantiates QwenLLMClient lazily without calling load().
    - Does not import torch or transformers.
    - Performs no network access or eager weight validation.
    """
    if settings is None:
        settings = get_settings()

    if not settings.MODEL_ENABLED:
        return None

    return _create_cached_client(
        settings.MODEL_PROVIDER.strip().lower(),
        settings.MODEL_NAME,
        settings.MODEL_GGUF_PATH,
        settings.MODEL_LOCAL_FILES_ONLY,
        settings.MODEL_DEVICE,
        settings.MODEL_TORCH_DTYPE,
        settings.MODEL_MAX_NEW_TOKENS,
        settings.MODEL_DO_SAMPLE,
        settings.MODEL_TEMPERATURE,
        settings.MODEL_TOP_P,
        settings.MODEL_REPETITION_PENALTY,
        settings.MODEL_TRUST_REMOTE_CODE,
        settings.MODEL_N_THREADS,
        settings.MODEL_CONTEXT_SIZE,
    )

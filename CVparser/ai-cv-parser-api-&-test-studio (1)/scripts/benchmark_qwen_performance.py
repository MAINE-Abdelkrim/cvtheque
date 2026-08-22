"""Local fictional benchmark for decomposing Qwen load and generation latency."""

from pathlib import Path
import json
import os
import sys
import time

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

import psutil

from app.core.config import Settings
from app.llm.client_factory import create_llm_client
from app.llm.cv_semantic_prompts import build_semantic_section_prompt


def rss_mb() -> float:
    return round(psutil.Process().memory_info().rss / 1024 / 1024, 1)


def timed_generation(client, prompt: str, label: str) -> dict:
    tokenizer = client._tokenizer
    input_tokens = len(tokenizer(prompt, add_special_tokens=True)["input_ids"])
    before = rss_mb()
    started = time.perf_counter()
    output = client.generate(prompt)
    elapsed = time.perf_counter() - started
    output_tokens = len(tokenizer(output, add_special_tokens=False)["input_ids"])
    return {
        "label": label,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "seconds": round(elapsed, 3),
        "tokens_per_second": round(output_tokens / elapsed, 3) if elapsed else None,
        "rss_before_mb": before,
        "rss_after_mb": rss_mb(),
        "valid_json_object": output.lstrip().startswith("{") and output.rstrip().endswith("}"),
        "output_preview": output[:300],
    }


def main() -> int:
    settings = Settings(
        MODEL_ENABLED=True,
        MODEL_LOCAL_FILES_ONLY=True,
        MODEL_DEVICE="cpu",
        MODEL_MAX_NEW_TOKENS=int(os.getenv("BENCHMARK_MAX_NEW_TOKENS", "512")),
        _env_file=None,
    )
    started = time.perf_counter()
    client = create_llm_client(settings)
    client_seconds = time.perf_counter() - started
    if client is None:
        return 2

    before_load = rss_mb()
    started = time.perf_counter()
    client.load()
    load_seconds = time.perf_counter() - started

    tokenizer = client._tokenizer
    model = client._model
    section = "Python\nFastAPI\nPostgreSQL"
    prompt = build_semantic_section_prompt("SKILLS", section)
    started = time.perf_counter()
    tokenized = tokenizer(prompt, return_tensors="pt")
    tokenize_seconds = time.perf_counter() - started

    measurements = {
        "python": sys.version.split()[0],
        "client_init_seconds": round(client_seconds, 4),
        "load_seconds": round(load_seconds, 3),
        "rss_before_load_mb": before_load,
        "rss_after_load_mb": rss_mb(),
        "device": client.resolved_device,
        "dtype": client.resolved_dtype,
        "model_training": bool(model.training),
        "grad_enabled": __import__("torch").is_grad_enabled(),
        "torch_threads": __import__("torch").get_num_threads(),
        "torch_interop_threads": __import__("torch").get_num_interop_threads(),
        "max_new_tokens": client.max_new_tokens,
        "do_sample": client.do_sample,
        "tokenization_seconds": round(tokenize_seconds, 5),
        "semantic_prompt_chars": len(prompt),
        "semantic_prompt_tokens": int(tokenized["input_ids"].shape[1]),
        "generations": [],
    }
    for index in range(1, 4):
        measurements["generations"].append(timed_generation(client, prompt, f"semantic_{index}"))
        print(json.dumps(measurements["generations"][-1]), flush=True)
    print("FINAL=" + json.dumps(measurements), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

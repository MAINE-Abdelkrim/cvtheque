"""Manual cold/warm llama.cpp smoke test using one fictional section only."""

from pathlib import Path
import argparse
import json
import sys
import time

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

import psutil

from app.llm.cv_semantic_prompts import build_semantic_section_prompt
from app.llm.llama_cpp_client import LlamaCppLLMClient

SECTION = """INTERNSHIP ATLAS SERVICES - OUJDA
June 2024 - July 2024
Prepared reports and maintained customer records."""


def rss_mb() -> float:
    return round(psutil.Process().memory_info().rss / 1024 / 1024, 1)


def available_ram_mb() -> float:
    return round(psutil.virtual_memory().available / 1024 / 1024, 1)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("model", type=Path)
    args = parser.parse_args()
    client = LlamaCppLLMClient(
        str(args.model), enabled=True, n_threads=4, n_ctx=1024,
        max_tokens=256, temperature=0.0,
    )
    prompt = build_semantic_section_prompt("EXPERIENCES", SECTION)
    before_load = rss_mb()
    system_available_before_load_mb = available_ram_mb()
    started = time.perf_counter()
    client.load()
    load_seconds = time.perf_counter() - started
    model = client._model
    input_tokens = len(model.tokenize(prompt.encode("utf-8"), add_bos=True))
    generations = []
    for label in ("cold", "warm"):
        started = time.perf_counter()
        output = client.generate(prompt)
        seconds = time.perf_counter() - started
        output_tokens = len(model.tokenize(output.encode("utf-8"), add_bos=False))
        generations.append({
            "label": label, "seconds": round(seconds, 3),
            "input_tokens": input_tokens, "output_tokens": output_tokens,
            "tokens_per_second": round(output_tokens / seconds, 3) if seconds else None,
            "rss_mb": rss_mb(), "output": output,
        })
        print(json.dumps(generations[-1]), flush=True)
    print("FINAL=" + json.dumps({
        "model_bytes": args.model.stat().st_size,
        "load_seconds": round(load_seconds, 3),
        "rss_before_load_mb": before_load,
        "rss_after_test_mb": rss_mb(),
        "system_available_before_load_mb": system_available_before_load_mb,
        "system_available_after_warm_mb": available_ram_mb(),
        "generations": generations,
    }), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

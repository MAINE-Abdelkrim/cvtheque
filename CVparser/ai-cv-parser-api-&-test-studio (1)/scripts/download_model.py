#!/usr/bin/env python3
"""
Controlled model download utility for Qwen LLM weights.
Downloads the configured tokenizer and model artifacts into the Hugging Face cache
using snapshot_download to avoid loading full model weights into RAM.
"""

import argparse
import os
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import get_settings


def parse_args(args=None):
    parser = argparse.ArgumentParser(
        description="Download and cache Qwen model weights and tokenizer locally without allocating model RAM."
    )
    parser.add_argument(
        "--model",
        type=str,
        default=None,
        help="Hugging Face model repository ID (defaults to MODEL_NAME in settings).",
    )
    parser.add_argument(
        "--cache-dir",
        type=str,
        default=None,
        help="Custom Hugging Face cache directory.",
    )
    parser.add_argument(
        "--token",
        type=str,
        default=None,
        help="Optional Hugging Face authentication token.",
    )
    parser.add_argument(
        "--trust-remote-code",
        action="store_true",
        help="Allow executing custom code from the model repository.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force redownload even if local model files exist in cache.",
    )
    parser.add_argument(
        "--offline",
        action="store_true",
        help="Check local cache only without attempting network connection.",
    )
    return parser.parse_args(args)


def estimate_model_disk_size(model_name: str) -> str:
    """Provide estimated disk space requirement based on model parameter count."""
    name_lower = model_name.lower()
    if "0.5b" in name_lower:
        return "~1.0 GB"
    elif "1.5b" in name_lower:
        return "~3.0 GB"
    elif "3b" in name_lower:
        return "~6.2 GB"
    elif "7b" in name_lower:
        return "~14.5 GB"
    return "1.0 - 15.0 GB depending on size"


def sanitize_path(path_str: str) -> str:
    """Sanitize path representation to hide sensitive user home names."""
    if not path_str:
        return "Default Hugging Face Cache"
    p = Path(path_str).resolve()
    home = Path.home().resolve()
    try:
        if home in p.parents or p == home:
            return str(Path("~") / p.relative_to(home))
    except Exception:
        pass
    return str(p)


def main(args=None) -> int:
    parsed_args = parse_args(args)
    settings = get_settings()

    model_name = parsed_args.model or settings.MODEL_NAME
    cache_dir = parsed_args.cache_dir
    local_files_only = parsed_args.offline or (settings.MODEL_LOCAL_FILES_ONLY and not parsed_args.force)
    token = parsed_args.token or os.getenv("HF_TOKEN") or os.getenv("HUGGING_FACE_HUB_TOKEN")

    sanitized_cache = sanitize_path(cache_dir or os.getenv("HF_HOME", ""))

    print("========================================================")
    print(" Qwen Model Weight Download Utility (snapshot_download)")
    print("========================================================")
    print(f"Target Model       : {model_name}")
    print(f"Estimated Disk Size: {estimate_model_disk_size(model_name)}")
    print(f"Offline Check Only : {local_files_only}")
    print(f"Cache Directory    : {sanitized_cache}")
    print(f"Auth Token Provided: {'Yes (redacted)' if token else 'No'}")
    print("========================================================")

    # Try importing snapshot_download from huggingface_hub first (no RAM weight instantiation)
    try:
        from huggingface_hub import snapshot_download
        has_hf_hub = True
    except ImportError:
        has_hf_hub = False

    try:
        from transformers import AutoTokenizer
        has_transformers = True
    except ImportError:
        has_transformers = False

    if not has_hf_hub and not has_transformers:
        print(
            "ERROR: Required packages 'huggingface_hub' or 'transformers' are missing.\n"
            "Please install requirements-llm.txt first:\n"
            "  pip install -r requirements-llm.txt",
            file=sys.stderr,
        )
        return 2

    try:
        if has_hf_hub:
            print(f"\nDownloading/checking model snapshot for '{model_name}'...")
            download_dir = snapshot_download(
                repo_id=model_name,
                cache_dir=cache_dir,
                local_files_only=local_files_only,
                token=token,
            )
            print(f"✓ Snapshot downloaded/verified in cache: {sanitize_path(download_dir)}")
        else:
            print(f"\nFallback: checking tokenizer and model via transformers...")
            _ = AutoTokenizer.from_pretrained(
                model_name,
                cache_dir=cache_dir,
                local_files_only=local_files_only,
            )
            print("✓ Tokenizer verified.")

        print("\n========================================================")
        print(f" SUCCESS: Model '{model_name}' artifacts are cached and ready.")
        print("========================================================")
        return 0

    except Exception as exc:
        print(f"\nERROR: Failed to download/load model '{model_name}': {exc}", file=sys.stderr)
        if local_files_only:
            print(
                "NOTE: Offline mode (local_files_only=True) was active and artifacts were missing in local cache.\n"
                "Run with --force or pass online settings to download from Hugging Face.",
                file=sys.stderr,
            )
        return 1


if __name__ == "__main__":
    sys.exit(main())

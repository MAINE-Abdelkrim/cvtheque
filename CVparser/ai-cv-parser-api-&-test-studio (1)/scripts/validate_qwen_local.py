#!/usr/bin/env python3
"""
Controlled real-model validation utility for local execution on Windows/Linux.
Validates environment memory, loads configured Qwen model, tests synthetic generation,
optionally processes a CV via CVProcessingService, and reports timing/memory metrics.
"""

import argparse
import gc
import json
import os
import platform
import sys
import time
from pathlib import Path
from typing import Any, Dict, Optional

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import Settings, get_settings
from scripts.cv_input import prepare_pdf_bytes


def parse_args(args=None):
    parser = argparse.ArgumentParser(
        description="Run local Qwen LLM validation and CV parsing benchmark."
    )
    parser.add_argument(
        "--model",
        type=str,
        default=None,
        help="Model ID override (e.g., Qwen/Qwen2.5-0.5B-Instruct).",
    )
    parser.add_argument(
        "--device",
        type=str,
        default=None,
        help="Device override ('cpu', 'cuda', 'auto').",
    )
    parser.add_argument(
        "--cv",
        type=str,
        default=None,
        help="Path to sample CV file (.txt, .pdf) to process.",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Path to save JSON benchmark results.",
    )
    parser.add_argument(
        "--offline",
        action="store_true",
        help="Force local_files_only mode.",
    )
    parser.add_argument(
        "--skip-cv",
        action="store_true",
        help="Skip CV extraction step and test synthetic prompt generation only.",
    )
    parser.add_argument(
        "--max-new-tokens",
        type=int,
        default=None,
        help="Maximum generation tokens override.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Bypass low memory safety checks.",
    )
    return parser.parse_args(args)


def get_process_memory_mb() -> float:
    """Get current process RSS memory in MB safely."""
    try:
        import psutil
        process = psutil.Process(os.getpid())
        return process.memory_info().rss / (1024 * 1024)
    except Exception:
        return 0.0


def get_system_ram_gb() -> tuple[float, float]:
    """Return (total_ram_gb, available_ram_gb). Returns (0.0, 0.0) if unavailable."""
    try:
        import psutil
        mem = psutil.virtual_memory()
        return mem.total / (1024**3), mem.available / (1024**3)
    except Exception:
        return 0.0, 0.0


def check_cuda_available() -> tuple[bool, str]:
    """Check PyTorch CUDA availability and device name."""
    try:
        import torch
        if torch.cuda.is_available():
            device_name = torch.cuda.get_device_name(0)
            return True, device_name
        return False, "N/A"
    except Exception:
        return False, "Torch unavailable"


def main(args=None) -> int:
    start_time = time.perf_counter()
    parsed_args = parse_args(args)
    base_settings = get_settings()

    model_name = parsed_args.model or base_settings.MODEL_NAME
    device = parsed_args.device or base_settings.MODEL_DEVICE
    max_tokens = parsed_args.max_new_tokens or base_settings.MODEL_MAX_NEW_TOKENS
    offline = parsed_args.offline or base_settings.MODEL_LOCAL_FILES_ONLY

    # 1. Display Sanitized Configuration
    print("========================================================")
    print(" Local Qwen Model Validation Utility")
    print("========================================================")
    print("Sanitized Configuration:")
    print(f"  MODEL_NAME            : {model_name}")
    print(f"  MODEL_DEVICE          : {device}")
    print(f"  MODEL_MAX_NEW_TOKENS  : {max_tokens}")
    print(f"  MODEL_LOCAL_FILES_ONLY: {offline}")
    print(f"  MODEL_ENABLED         : True (Override for validation)")

    # 2. System Information
    python_ver = sys.version.split()[0]
    os_info = f"{platform.system()} {platform.release()} ({platform.machine()})"
    total_ram_gb, avail_ram_gb = get_system_ram_gb()
    cuda_avail, cuda_device = check_cuda_available()

    print("\nSystem Environment:")
    print(f"  OS Platform           : {os_info}")
    print(f"  Python Version        : {python_ver}")
    print(f"  Total System RAM      : {total_ram_gb:.2f} GB" if total_ram_gb else "  Total System RAM      : Unknown (psutil not installed)")
    print(f"  Available RAM         : {avail_ram_gb:.2f} GB" if avail_ram_gb else "  Available RAM         : Unknown")
    print(f"  CUDA Available        : {cuda_avail} ({cuda_device})")

    # 3. Check memory safety threshold
    if avail_ram_gb > 0 and avail_ram_gb < 1.2 and not parsed_args.force:
        print(
            f"\nERROR [Exit Code 6]: Available RAM ({avail_ram_gb:.2f} GB) is critically low (< 1.2 GB).\n"
            "Execution refused to prevent system freeze or OOM crash. Use --force to override.",
            file=sys.stderr,
        )
        return 6

    # 4. Check dependencies
    try:
        import torch
        import transformers
    except ImportError as err:
        print(
            f"\nERROR [Exit Code 2]: Missing required LLM libraries: {err}.\n"
            "Please install requirements-llm.txt.",
            file=sys.stderr,
        )
        return 2

    client = None
    exit_code = 0
    metrics: Dict[str, Any] = {
        "model_name": model_name,
        "device": device,
    }

    try:
        # 5. Initialize Services and Load Model
        mem_before_load = get_process_memory_mb()
        load_start = time.perf_counter()

        from app.llm.qwen_client import QwenLLMClient
        from app.services.cv_processing_service import CVProcessingService

        validation_settings = Settings(
            MODEL_ENABLED=True,
            MODEL_NAME=model_name,
            MODEL_DEVICE=device,
            MODEL_LOCAL_FILES_ONLY=offline,
            MODEL_MAX_NEW_TOKENS=max_tokens,
            MODEL_DO_SAMPLE=False,
            MODEL_TEMPERATURE=0.0,
        )

        client = QwenLLMClient(
            model_name_or_path=model_name,
            enabled=True,
            local_files_only=offline,
            device=device,
            max_new_tokens=max_tokens,
        )

        print(f"\nLoading model '{model_name}' on device '{device}'...")
        client.load()
        load_duration = time.perf_counter() - load_start
        mem_after_load = get_process_memory_mb()
        print(f"✓ Model loaded successfully in {load_duration:.2f}s (Process RAM: {mem_after_load:.1f} MB)")

        metrics["load_duration_s"] = round(load_duration, 3)
        metrics["mem_before_load_mb"] = round(mem_before_load, 1)
        metrics["mem_after_load_mb"] = round(mem_after_load, 1)

        # 6. Test Synthetic Prompt Generation
        inf_start = time.perf_counter()
        synthetic_prompt = (
            '{"task": "test", "instructions": "Return JSON ONLY", "data": {"greeting": "hello"}}'
        )
        print("\nExecuting synthetic prompt generation test...")
        synth_response = client.generate(synthetic_prompt)
        synth_duration = time.perf_counter() - inf_start
        print(f"✓ Synthetic generation completed in {synth_duration:.2f}s.")
        metrics["synthetic_duration_s"] = round(synth_duration, 3)
        metrics["synthetic_response_length"] = len(synth_response)

        # 7. Optional CV File Processing
        if not parsed_args.skip_cv:
            cv_path_str = parsed_args.cv
            if not cv_path_str:
                default_fixture = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "synthetic_cv.txt"
                if default_fixture.exists():
                    cv_path_str = str(default_fixture)

            if cv_path_str and os.path.exists(cv_path_str):
                print(f"\nProcessing CV file: {os.path.basename(cv_path_str)}")
                cv_start = time.perf_counter()
                cv_service = CVProcessingService(settings=validation_settings)
                cv_service.llm_client = client

                with open(cv_path_str, "rb") as f:
                    file_bytes = f.read()
                pdf_bytes = prepare_pdf_bytes(file_bytes)

                # Stage A: Deterministic result
                deterministic_settings = validation_settings.model_copy(
                    update={"MODEL_ENABLED": False}
                )
                deterministic_service = CVProcessingService(
                    settings=deterministic_settings
                )
                det_result = deterministic_service.process_pdf(pdf_bytes)
                # Stage B: Enriched result (deterministic + LLM completion)
                enriched_result = cv_service.process_pdf(pdf_bytes, client=client)
                cv_duration = time.perf_counter() - cv_start

                print("\n========================================================")
                print(" STAGED EXTRACTION SUMMARY (PII Redacted)")
                print("========================================================")
                print(f"1. Deterministic Fields Present  : {[f for f in ['full_name', 'email', 'phone'] if getattr(det_result.cv_data.identity, f)]}")
                print(f"2. Deterministic Skills Count    : {len(det_result.cv_data.skills)}")
                print(f"3. Enriched Skills Count         : {len(enriched_result.cv_data.skills)}")
                print(f"4. LLM Completion Warnings       : {enriched_result.cv_data.warnings}")
                print(f"5. Processing Duration           : {cv_duration:.2f}s")

                metrics["cv_processing_duration_s"] = round(cv_duration, 3)
                metrics["deterministic_skills_count"] = len(det_result.cv_data.skills)
                metrics["enriched_skills_count"] = len(enriched_result.cv_data.skills)
                metrics["warnings"] = enriched_result.cv_data.warnings

        # Report Summary
        total_duration = time.perf_counter() - start_time
        mem_final = get_process_memory_mb()
        metrics["total_duration_s"] = round(total_duration, 3)
        metrics["mem_final_mb"] = round(mem_final, 1)

        print("\n========================================================")
        print(" LOCAL VALIDATION SUMMARY")
        print("========================================================")
        print(f"  Model Load Time     : {load_duration:.2f}s")
        print(f"  Total Duration      : {total_duration:.2f}s")
        print(f"  Process Memory RSS  : Initial={mem_before_load:.1f}MB | Loaded={mem_after_load:.1f}MB | Final={mem_final:.1f}MB")
        print("========================================================")

        if parsed_args.output:
            try:
                with open(parsed_args.output, "w", encoding="utf-8") as f:
                    json.dump(metrics, f, indent=2)
                print(f"Saved benchmark metrics to '{parsed_args.output}'.")
            except Exception as exc:
                print(f"Warning: Failed to save output to '{parsed_args.output}': {exc}")

    except Exception as exc:
        print(f"\nERROR: Validation failed: {exc}", file=sys.stderr)
        exit_code = 3
    finally:
        if client is not None:
            print("\nCleaning up model resources...")
            client.cleanup()
            gc.collect()
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except Exception:
                pass
            print("✓ Model cleanup finished.")

    return exit_code


if __name__ == "__main__":
    sys.exit(main())

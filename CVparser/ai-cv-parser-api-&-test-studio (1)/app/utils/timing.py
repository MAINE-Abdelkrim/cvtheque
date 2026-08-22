"""
Timing context managers and decorators for benchmarking pipeline step durations.
"""

import time
from typing import Callable, Any, Tuple


class Timer:
    """
    Context manager to measure execution duration of code blocks in milliseconds.
    Usage:
        with Timer() as t:
            do_something()
        print(f"Elapsed: {t.duration_ms:.2f} ms")
    """

    def __init__(self):
        self.start_time: float = 0.0
        self.end_time: float = 0.0
        self.duration_ms: float = 0.0
        self.duration_sec: float = 0.0

    def __enter__(self):
        self.start_time = time.perf_counter()
        return self

    def lap(self) -> float:
        """
        Calculates and returns the elapsed time in milliseconds from start_time up to now
        without stopping or exiting the timer context.
        """
        if self.start_time == 0.0:
            return 0.0
        elapsed = time.perf_counter() - self.start_time
        return round(elapsed * 1000.0, 2)

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.end_time = time.perf_counter()
        elapsed = self.end_time - self.start_time
        self.duration_sec = elapsed
        self.duration_ms = round(elapsed * 1000.0, 2)


def measure_execution_time(fn: Callable[..., Any], *args, **kwargs) -> Tuple[Any, float]:
    """
    Executes a function and returns a tuple (result, duration_ms).
    """
    start = time.perf_counter()
    result = fn(*args, **kwargs)
    duration_ms = round((time.perf_counter() - start) * 1000.0, 2)
    return result, duration_ms

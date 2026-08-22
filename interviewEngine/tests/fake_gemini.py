from types import SimpleNamespace
from typing import Any


class FakeGeminiModels:
    def __init__(self, results: list[object]) -> None:
        self.results = list(results)
        self.calls: list[dict[str, Any]] = []

    async def generate_content(
        self, *, model: str, contents: str, config: Any
    ) -> SimpleNamespace:
        self.calls.append({"model": model, "contents": contents, "config": config})
        result = self.results.pop(0)
        if isinstance(result, Exception):
            raise result
        return SimpleNamespace(parsed=result)


class FakeGeminiClient:
    def __init__(self, results: list[object]) -> None:
        self.models = FakeGeminiModels(results)
        self.aio = SimpleNamespace(models=self.models)

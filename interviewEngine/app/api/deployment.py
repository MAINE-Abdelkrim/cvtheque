from collections import deque
from collections.abc import Awaitable, Callable

from starlette.responses import JSONResponse
from starlette.types import Message, Receive, Scope, Send

ASGIApp = Callable[[Scope, Receive, Send], Awaitable[None]]


class RequestBodyLimitMiddleware:
    """Reject HTTP request bodies that exceed a configured byte limit."""

    def __init__(self, app: ASGIApp, *, max_request_bytes: int) -> None:
        self._app = app
        self._max_request_bytes = max_request_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self._app(scope, receive, send)
            return

        if self._declared_body_is_too_large(scope):
            await self._response(scope, receive, send)
            return

        received_bytes = 0
        messages: deque[Message] = deque()
        while True:
            message = await receive()
            messages.append(message)
            if message["type"] == "http.request":
                received_bytes += len(message.get("body", b""))
                if received_bytes > self._max_request_bytes:
                    await self._response(scope, receive, send)
                    return
                if not message.get("more_body", False):
                    break
            elif message["type"] == "http.disconnect":
                break

        async def replay_receive() -> Message:
            return messages.popleft() if messages else await receive()

        await self._app(scope, replay_receive, send)

    def _declared_body_is_too_large(self, scope: Scope) -> bool:
        for name, value in scope.get("headers", []):
            if name.lower() != b"content-length":
                continue
            try:
                return int(value) > self._max_request_bytes
            except ValueError:
                return False
        return False

    @staticmethod
    async def _response(scope: Scope, receive: Receive, send: Send) -> None:
        response = JSONResponse(
            status_code=413,
            content={
                "error": {
                    "code": "REQUEST_TOO_LARGE",
                    "message": "Request body exceeds the allowed size",
                }
            },
        )
        await response(scope, receive, send)

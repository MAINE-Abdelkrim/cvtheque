# Standalone Deployment Boundary

This document defines hosting assumptions for the standalone Interview Engine. It does not select
a provider, deploy infrastructure, or integrate the main recruitment platform.

## Trust and TLS boundary

```text
Internet
  -> trusted TLS-terminating reverse proxy / load balancer / platform ingress
     -> trusted private network or private service route
        -> Interview Engine
```

TLS should terminate at a trusted reverse proxy, load balancer, or platform ingress. Traffic from
the future main backend to the engine must use TLS or a trusted private network. Network isolation
is defense in depth and never replaces the engine's internal bearer authentication. The engine is
server-to-server and must not be exposed directly to browsers. FastAPI/Uvicorn does not manage TLS
certificates in this project.

## CORS and trusted hosts

No CORS middleware is installed. In particular, there is no wildcard origin or browser credential
policy because browsers are not callers of this API.

`INTERVIEW_ALLOWED_HOSTS` optionally enables Starlette trusted-host validation with comma-separated
hostnames, for example `interview.internal.example,*.private.example`. Empty means unrestricted
Host handling for isolated local development. A bare `*` is rejected. Configure production hosts
explicitly; values are not returned in error responses.

Trusted-host validation uses the direct HTTP `Host` header. The application does not parse or trust
`X-Forwarded-Host`, `X-Forwarded-For`, `X-Real-IP`, or `Forwarded`. Proxy-header acceptance and the
set of trusted forwarding proxies must be configured at the reverse proxy and Uvicorn process
boundary. Forwarded values never participate in authentication or ownership decisions. Custom IP
allowlisting is intentionally absent.

## Request-size policy

`INTERVIEW_MAX_REQUEST_BYTES` defaults to 1,048,576 bytes. The ASGI middleware rejects a declared
oversized body before parsing and also counts actual streamed bytes when `Content-Length` is absent
or unusable. Bodies within the limit are replayed unchanged to FastAPI. Rejection is HTTP 413 with
the safe code `REQUEST_TOO_LARGE`; the request body is neither echoed nor logged.

This byte limit protects parsing memory before the narrower Pydantic field/list limits run. A
trusted reverse proxy should enforce the same or a stricter limit to reject oversized traffic
before it reaches the process.

## Timeout ownership

- The resilient provider boundary owns each provider-operation timeout and retry policy.
- The repository transaction owns atomic persistence and version-conflict detection.
- The reverse proxy/ingress owns the whole HTTP request deadline.

No global application cancellation timeout is added. Cancelling a request while an external SDK or
persistence operation is completing can create an ambiguous caller outcome even when the database
state itself remains atomic. Proxy timeouts must allow the configured provider attempts plus normal
repository overhead, and callers must handle controlled conflicts rather than blindly replaying an
answer transition.

## Rate limiting

Rate limiting belongs at the reverse proxy, API gateway, or trusted main backend. An in-process
counter would diverge across workers and hosts and would be misleading. Recommended logical buckets
are the authenticated backend service token, optionally the opaque owner ID, a stricter bucket for
interview creation, and a separate answer-submission bucket. Actual numbers depend on measured
traffic and are not prescribed here. No Redis or distributed limiter is included.

## Health and errors

`GET /health` is a cheap liveness endpoint returning only:

```json
{"status":"ok","service":"ai-interview-engine"}
```

It does not initialize or call Gemini, Firebase, Firestore, or a repository and does not reveal
provider/model selection, project IDs, paths, authentication state, tokens, owners, or environment
details. Access policy for the health route belongs at the proxy/platform level.

Expected authentication, service, provider, and repository failures use sanitized stable envelopes.
FastAPI debug mode is not enabled. Unexpected production responses use the framework's generic 500
response; application code does not return traceback or exception repr data. Request bodies and
security headers must not be added to access/error logs.

## Process and worker model

The in-memory repository requires exactly one worker. Its state is process-local and disappears on
restart. `InterviewService`'s mutation lock coordinates only coroutines using the same service
instance in one process.

Firestore is durable shared persistence, and repository version checks/transactions provide the
cross-process lost-update protection. Multiple application processes are conceptually possible
with Firestore, but load and operational testing is still pending. Concurrent callers can receive
the controlled `SESSION_CONFLICT` response and must resolve it at the higher layer; answer requests
must not be blindly retried.

Local development command:

```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

Deployment-neutral server example behind the trusted proxy:

```powershell
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --no-proxy-headers
```

`--workers 1` is mandatory with `in_memory`. Firestore deployments may choose more workers only
after operational testing. If proxy headers are later required for observability or URL generation,
configure Uvicorn's trusted proxy allowlist deliberately rather than accepting forwarded headers
from arbitrary peers.

## External configuration

Secrets remain externally provisioned through environment variables or a deployment secret
injection mechanism. `.env` is local-only. No Docker, Kubernetes, cloud secret manager, certificate
automation, ingress, or hosting provider is selected or implemented by this project.

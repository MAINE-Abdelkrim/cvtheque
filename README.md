# CVtheque

CVtheque is a recruitment platform with a React/Express application and three
Python services for CV parsing, deterministic matching, and text interviews.

The verified core includes Firebase authentication and role isolation,
canonical CV and Job persistence, recruiter matching, and candidate text
interviews. Oral Interview is future work and is not implemented or verified.

Start with the [developer handoff guide](docs/DEVELOPER_HANDOFF.md). It contains
the architecture, environment setup, service commands, tests, stable contracts,
known limitations, and next-development priorities. Detailed local runtime
troubleshooting remains in [Local Runtime](docs/LOCAL_RUNTIME.md).

Never commit `.env` files, service-account JSON, private keys, downloaded models,
virtual environments, logs, caches, or generated build output.

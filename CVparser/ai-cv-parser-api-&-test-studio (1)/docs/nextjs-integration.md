# Next.js integration

The backend accepts a PDF as `multipart/form-data` at `POST /api/v1/cv/parse`.
For a Next.js App Router project, proxy the upload through a Route Handler. This
keeps the Python API URL server-side and avoids browser CORS differences between
development and deployment.

## 1. Configure Next.js

Add this to the Next.js project's `.env.local`:

```env
CV_PARSER_API_URL=http://127.0.0.1:8000
```

## 2. Add a Route Handler

Create `app/api/cv/parse/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const incoming = await request.formData();
  const file = incoming.get("file");

  if (!(file instanceof File) || file.type !== "application/pdf") {
    return NextResponse.json({ detail: "A PDF file is required." }, { status: 400 });
  }

  const backendUrl = process.env.CV_PARSER_API_URL;
  if (!backendUrl) {
    return NextResponse.json({ detail: "CV parser API is not configured." }, { status: 503 });
  }

  const body = new FormData();
  body.set("file", file, file.name);

  try {
    const response = await fetch(`${backendUrl}/api/v1/cv/parse`, {
      method: "POST",
      body,
      cache: "no-store",
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ detail: "CV parser API is unavailable." }, { status: 502 });
  }
}
```

Do not manually set `Content-Type`; `fetch` adds the multipart boundary.

## 3. Upload from a client component

```tsx
"use client";

import { FormEvent, useState } from "react";

export function CvUploader() {
  const [result, setResult] = useState<unknown>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/cv/parse", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail ?? "CV parsing failed");
      setResult(payload);
    } catch (value) {
      setError(value instanceof Error ? value.message : "CV parsing failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <input name="file" type="file" accept="application/pdf,.pdf" required />
      <button disabled={loading}>{loading ? "Parsing…" : "Parse CV"}</button>
      {error && <p role="alert">{error}</p>}
      {result !== undefined && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </form>
  );
}
```

The generated API schema and interactive documentation are available at
`http://127.0.0.1:8000/openapi.json` and `http://127.0.0.1:8000/docs`.

For direct browser-to-FastAPI calls instead, set `NEXTJS_ORIGIN` to the exact
frontend origin (for example `https://app.example.com`). The current backend
supports one origin; the server-side proxy is preferable for multiple preview
deployments.

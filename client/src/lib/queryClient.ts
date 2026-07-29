import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// ─── Typed fetch wrapper ──────────────────────────────────────────────────────
type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE" | "PUT";

export async function apiFetch<T = unknown>(
  url: string,
  method: HttpMethod = "GET",
  body?: unknown
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json?.error ?? `Request failed: ${res.status}`);
  }

  return json.data as T;
}

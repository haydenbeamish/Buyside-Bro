import { QueryClient, QueryFunction } from "@tanstack/react-query";

const API_KEY = import.meta.env.VITE_API_KEY || "";

function apiHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {};
  if (API_KEY) headers["x-api-key"] = API_KEY;
  if (extra) Object.assign(headers, extra);
  return headers;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export function getUserMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400: return "Invalid request. Please check your input and try again.";
      case 401: return "Please log in to continue.";
      case 403: return "You don't have permission to do that.";
      case 429: return "Too many requests. Please wait a moment and try again.";
      case 503: return "Service temporarily unavailable. Please try again later.";
      default: return "Something went wrong. Please try again.";
    }
  }
  return "Something went wrong. Please try again.";
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.message || body.error || JSON.stringify(body);
    } catch {
      const text = await res.text();
      if (text) message = text;
    }
    throw new ApiError(res.status, message);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: apiHeaders(data ? { "Content-Type": "application/json" } : undefined),
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers: apiHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 5 * 60 * 1000, // 5 minutes default
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

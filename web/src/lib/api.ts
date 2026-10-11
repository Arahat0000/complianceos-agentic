const API_BASE_URL = import.meta.env.VITE_API_URL;

/**
 * Backend API — all paths are relative to VITE_API_URL.
 *
 * The JWT token is read from localStorage ("auth_token") and automatically
 * attached as Authorization: Bearer <token> on every request.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = typeof window !== "undefined"
    ? window.localStorage.getItem("auth_token")
    : null;

  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...authHeader,
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (!isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    throw new Error(`API request failed with status ${res.status}`);
  }

  // Handle empty responses
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  
  return {} as T;
}

import type { ApiResponse } from "@/lib/types"

const ROLE_STORAGE_KEY = "sms-role"
const USER_ID_STORAGE_KEY = "sms-user-id"

export async function fetchApi<
  T,
  TResponse extends ApiResponse<T> = ApiResponse<T>,
>(url: string, options: RequestInit = {}): Promise<TResponse> {
  const headers = new Headers(options.headers)

  if (typeof window !== "undefined") {
    const userId = window.localStorage.getItem(USER_ID_STORAGE_KEY)
    const role = window.localStorage.getItem(ROLE_STORAGE_KEY)

    if (userId !== null && !headers.has("x-user-id")) {
      headers.set("x-user-id", userId)
    }

    if (role !== null && !headers.has("x-user-role")) {
      headers.set("x-user-role", role)
    }
  }

  try {
    const response = await fetch(url, { ...options, headers })
    const payload = await parseResponse<T, TResponse>(response)

    if (!response.ok) {
      return {
        data: null,
        error: payload.error ?? `Request failed with status ${response.status}`,
      } as TResponse
    }

    return payload
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error
    }

    return {
      data: null,
      error: "Network error. Please check your connection.",
    } as TResponse
  }
}

async function parseResponse<T, TResponse extends ApiResponse<T>>(
  response: Response
): Promise<TResponse> {
  try {
    const payload = (await response.json()) as TResponse

    if (payload.error !== null) {
      return payload
    }

    if (payload.data !== null) {
      return payload
    }

    return {
      data: null,
      error: "Invalid server response",
    } as TResponse
  } catch {
    return {
      data: null,
      error: "Invalid server response",
    } as TResponse
  }
}

import type { ApiResponse } from "@/lib/types"

const ROLE_STORAGE_KEY = "sms-role"
const USER_ID_STORAGE_KEY = "sms-user-id"

type FetchApiOptions<T, TResponse extends ApiResponse<T>> = RequestInit & {
  onSuccess?: (payload: Extract<TResponse, { error: null }>) => void
  onError?: (payload: Extract<TResponse, { data: null }>) => void
}

export async function fetchApi<
  T,
  TResponse extends ApiResponse<T> = ApiResponse<T>,
>(url: string, options: FetchApiOptions<T, TResponse> = {}): Promise<TResponse> {
  const { onSuccess, onError, ...requestOptions } = options
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
    const response = await fetch(url, { ...requestOptions, headers })
    const payload = await parseResponse<T, TResponse>(response)

    if (!response.ok) {
      const errorPayload = {
        data: null,
        error:
          response.status >= 500
            ? "An unexpected error occurred. Please try again."
            : (payload.error ?? `Request failed with status ${response.status}`),
        status: response.status,
        errorKind: response.status >= 500 ? "server" : "api",
      } as Extract<TResponse, { data: null }>

      onError?.(errorPayload)
      return errorPayload as TResponse
    }

    if (payload.error === null) {
      onSuccess?.(payload as Extract<TResponse, { error: null }>)
    } else {
      onError?.(payload as Extract<TResponse, { data: null }>)
    }

    return payload
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error
    }

    const errorPayload = {
      data: null,
      error: "Could not connect. Please check your connection and try again.",
      errorKind: "network",
    } as Extract<TResponse, { data: null }>

    onError?.(errorPayload)
    return errorPayload as TResponse
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
      errorKind: "invalid-response",
    } as TResponse
  } catch {
    return {
      data: null,
      error: "Invalid server response",
      errorKind: "invalid-response",
    } as TResponse
  }
}

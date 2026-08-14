/**
 * Thin client for the Express backend.
 *
 * Note: most backend routes are currently health-check stubs. Only the file /
 * document-summary endpoints under /api/files are implemented, so those are the
 * only ones typed here. Add the rest as the backend grows.
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(
      `Cannot reach the API at ${BASE_URL}. Is the backend running?`,
      0
    );
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body?.message ?? body?.error ?? detail;
    } catch {
      // Non-JSON error body; keep the status text.
    }
    throw new ApiError(detail, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface TenderSummary {
  _id: string;
  tenderId: string;
  tenderAddress: string;
  category?: string;
  summary?: {
    workType?: string;
    location?: string;
    estimatedValue?: string;
    confidence?: number;
    description?: string;
  };
  createdAt?: string;
}

export interface PublicSummariesResponse {
  summaries: TenderSummary[];
  total?: number;
  page?: number;
}

export interface SummaryStatistics {
  totalSummaries: number;
  averageConfidence?: number;
  byCategory?: Record<string, number>;
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  getPublicSummaries: (params: Record<string, string | number> = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ).toString();
    return request<PublicSummariesResponse>(
      `/api/files/public-summaries${qs ? `?${qs}` : ""}`
    );
  },

  getTenderSummary: (tenderAddress: string) =>
    request<TenderSummary>(`/api/files/tender-summary/${tenderAddress}`),

  getStatistics: () => request<SummaryStatistics>("/api/files/statistics"),

  uploadTenderDocument: (form: FormData) =>
    request<{ summary?: TenderSummary; jobId?: string }>(
      "/api/files/upload-tender-document",
      { method: "POST", body: form }
    ),
};

import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiError = { error: { code: string; message: string; details?: unknown } };

export class ApiHttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export async function withErrorHandler<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    const result = await fn();
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json<ApiError>(
        { error: { code: "bad_request", message: "Invalid request body", details: err.flatten() } },
        { status: 400 },
      );
    }
    if (err instanceof ApiHttpError) {
      return NextResponse.json<ApiError>({ error: { code: err.code, message: err.message } }, { status: err.status });
    }
    console.error("Unhandled API error:", err);
    return NextResponse.json<ApiError>(
      { error: { code: "internal_error", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}

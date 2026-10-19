// Error types shared by API routes and services. No framework imports, so the worker can use services too.

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Record') => new ApiError(404, 'not_found', `${what} not found.`);
export const forbidden = (why = 'You do not have permission for this.') => new ApiError(403, 'forbidden', why);
export const conflict = (why: string, fields?: Record<string, string>) => new ApiError(409, 'conflict', why, fields);
export const invalid = (why: string, fields?: Record<string, string>) => new ApiError(422, 'invalid', why, fields);

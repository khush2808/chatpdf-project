export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function withCors<T extends Response>(res: T): T {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.headers.set(key, value);
  });
  return res;
}
/**
 * Read and parse a JSON request body in a way that's reliable on Cloudflare
 * Workers + OpenNext.
 *
 * Why we clone first: NextRequest on Cloudflare Workers is backed by a
 * ReadableStream that can only be consumed once. Without cloning, downstream
 * readers see an empty string even when the client sent a real body.
 *
 * Returns `null` if the body is empty or unparseable; callers decide whether
 * that's a 400 or just an empty payload.
 */
export async function readJsonBody<T = unknown>(req: Request): Promise<T | null> {
  try {
    const cloned = req.clone();
    const text = await cloned.text();
    if (!text.trim()) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

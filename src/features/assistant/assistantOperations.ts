const attempts = new Map<string, string>();
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return "{" + Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, field]) => `${JSON.stringify(key)}:${canonical(field)}`).join(",") + "}";
  return JSON.stringify(value) ?? "null";
}
function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, character => {
    const value = globalThis.crypto?.getRandomValues ? globalThis.crypto.getRandomValues(new Uint8Array(1))[0]! & 15 : Math.floor(Math.random() * 16);
    return (character === "x" ? value : (value & 3) | 8).toString(16);
  });
}
/** A lost response reuses the same operation key. A changed payload is a new intent. */
export async function assistantOperation<T>(scope: string, kind: string, payload: unknown, send: (id: string) => Promise<T>): Promise<T> {
  const operation = `${scope}\0${kind}\0${canonical(payload)}`;
  const id = attempts.get(operation) ?? uuid();
  attempts.set(operation, id);
  try {
    const result = await send(id);
    attempts.delete(operation);
    return result;
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status && [400, 401, 403, 404, 422].includes(status)) attempts.delete(operation);
    throw error;
  }
}

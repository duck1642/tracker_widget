export function requireValue<T>(value: T | null | undefined, message = "Expected a value"): T {
  if (value === null || value === undefined) throw new Error(message);
  return value;
}

export function readTextFile(files: ReadonlyMap<string, string>, path: string): string {
  return requireValue(files.get(path), `File not found: ${path}`);
}

export function deferred<T = void>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => { throw new Error("Promise not initialized"); };
  let reject: (reason?: unknown) => void = () => { throw new Error("Promise not initialized"); };
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

export class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}
export async function api(path, body) {
  let response;
  try {
    response = await fetch(
      `/api/${path}`,
      body === undefined
        ? {}
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
    );
  } catch {
    throw new ApiError(
      "OFFLINE",
      "Cannot reach the desk. Check the server and try again.",
    );
  }
  const envelope = await response.json();
  if (!envelope.success)
    throw new ApiError(envelope.error.code, envelope.error.message);
  return envelope.data;
}

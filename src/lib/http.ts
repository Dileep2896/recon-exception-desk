export type Reply = { status: number; body: unknown; contentType?: string };
export const json = (data: unknown, status = 200): Reply => ({
  status,
  body: { success: true, data },
});
export const error = (code: string, message: string, status = 400): Reply => ({
  status,
  body: { success: false, error: { code, message } },
});

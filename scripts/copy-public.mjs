import { cp } from "node:fs/promises";
await cp("public", "dist/public", { recursive: true });

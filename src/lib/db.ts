import mongoose from "mongoose";

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/pocket";

// Next.js can load a separate copy of mongoose for pages and for API routes.
// Each copy has its own models, so each one must open its own connection —
// the pending connection is kept on the mongoose instance itself, not shared.
type WithConnect = typeof mongoose & { __pocketConnect?: Promise<typeof mongoose> | null };

export async function db() {
  const m = mongoose as WithConnect;
  if (m.connection.readyState === 1) return m;
  if (!m.__pocketConnect) {
    m.__pocketConnect = m.connect(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 8000 }).catch((e) => {
      m.__pocketConnect = null;
      throw e;
    });
  }
  await m.__pocketConnect;
  return m;
}

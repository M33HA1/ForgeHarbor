import Fastify from "fastify";
import jwt from "jsonwebtoken";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';

// Fix for ES modules __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../config/.env") });

const app = Fastify();

// Simple JWT auth parser: expects "Authorization: Bearer <token>"
app.addHook('preHandler', async (req, reply) => {
  if (req.routerPath && req.routerPath.startsWith('/health')) {
    return; // no auth for health
  }
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return; // allow anonymous; route can enforce if needed
  }
  const token = auth.substring('Bearer '.length);
  try {
    const publicKey = process.env.JWT_PUBLIC_KEY || '';
    let decoded: any;
    if (publicKey) {
      decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
    } else {
      decoded = jwt.decode(token);
    }
    (req as any).user = decoded;
  } catch {
    // ignore invalid tokens; downstream can decide
  }
});

const mongo = new MongoClient(process.env.MONGO_URI || "mongodb://fh-mongo:27017");

app.get("/health", async (req, reply) => {
  let mongodbStatus = "disconnected";
  try {
    await mongo.db(process.env.MONGO_DB || "forgeharbor").command({ ping: 1 });
    mongodbStatus = "connected";
  } catch {
    mongodbStatus = "disconnected";
  }
  return { 
    status: "healthy", 
    service: "history-ts",
    timestamp: new Date().toISOString(),
    mongodb: mongodbStatus
  };
});

app.get("/history", async (req, reply) => {
  const { limit = "20", cursor, type, risk } = req.query as any;
  const db = mongo.db(process.env.MONGO_DB || "forgeharbor");
  const scans = db.collection("scans");

  const q: any = {};
  const user = (req as any).user;
  // Filter by user if available from JWT (common fields: sub, user_id, uid)
  const userId = user?.sub || user?.user_id || user?.uid || user?.id;
  if (userId) {
    q.user_id = userId;
  }
  if (type) q.type = type;
  if (risk) q["result.risk_level"] = risk;

  if (cursor) {
    try {
      const lastId = new ObjectId(Buffer.from(cursor, "base64").toString());
      q._id = { $lt: lastId };
    } catch {
    }
  }

  const items = await scans.find(q).sort({ _id: -1 }).limit(Number(limit)).toArray();

  let next_cursor: string | null = null;
  if (items.length > 0) {
    const last = items[items.length - 1]._id;
    next_cursor = Buffer.from(last.toHexString()).toString("base64");
  }

  return { items, next_cursor };
});

app.get("/history/:scan_id", async (req, reply) => {
  const { scan_id } = req.params as any;
  const db = mongo.db(process.env.MONGO_DB || "forgeharbor");
  const scans = db.collection("scans");
  const doc = await scans.findOne({ _id: new ObjectId(scan_id) });

  if (!doc) {
    return reply.status(404).send({ error: "not found" });
  }

  return doc;
});

const start = async () => {
  try {
    await mongo.connect();
    console.log("Connected to MongoDB");

    const port = Number(process.env.HISTORY_PORT || 8083);
    await app.listen({ port, host: "0.0.0.0" });

    console.log(`history-ts running on http://localhost:${port}`);
  } catch (err) {
    console.error("Failed to start history-ts:", err);
    process.exit(1);
  }
};

start();
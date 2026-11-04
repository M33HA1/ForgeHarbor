import Fastify from "fastify";
import jwt from "jsonwebtoken";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from 'url';

// Fix for ES modules __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../config/.env") });

const app = Fastify();
const publicKeyPath = process.env.JWT_PUBLIC_KEY_PATH || "/app/config/jwt-public.pem";
const publicKey = readFileSync(publicKeyPath, "utf8");
const jwtIssuer = process.env.JWT_ISSUER || "forgeharbor";
const jwtAudience = process.env.JWT_AUDIENCE || "forgeharbor-users";

// Data routes require a verified RS256 token. Health remains public.
app.addHook('preHandler', async (req, reply) => {
  if (req.url.split('?')[0] === '/history/health') {
    return; // no auth for health
  }
  const auth = req.headers['authorization'];
  const cookieToken = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('fh_access='))?.slice('fh_access='.length);
  const token = auth?.startsWith('Bearer ') ? auth.substring('Bearer '.length) : cookieToken;
  if (!token) {
    return reply.code(401).send({ error: 'authentication required' });
  }
  try {
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: jwtIssuer,
      audience: jwtAudience,
    });
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string' || !decoded.sub || typeof decoded.exp !== 'number') {
      return reply.code(401).send({ error: 'invalid token claims' });
    }
    (req as any).user = decoded;
  } catch {
    return reply.code(401).send({ error: 'invalid token' });
  }
});

const mongo = new MongoClient(process.env.MONGO_URI || "mongodb://fh-mongo:27017");

app.get("/history/health", async (req, reply) => {
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
  q.user_id = user.sub;
  if (type) {
    if (type !== "url" && type !== "file") {
      return reply.code(400).send({ error: "type must be url or file" });
    }
    q.scan_type = type;
  }
  if (risk) {
    if (risk !== "high" && risk !== "low") {
      return reply.code(400).send({ error: "risk must be high or low" });
    }

    // Prefer the canonical field and include legacy scanner records that predate it.
    q.$or = risk === "high"
      ? [
          { "result.risk_level": "high" },
          { "result.phishing": true },
          { "result.malicious": true },
        ]
      : [
          { "result.risk_level": "low" },
          { "result.phishing": false },
          { "result.malicious": false },
        ];
  }

  const pageSize = Math.min(Math.max(Number.parseInt(String(limit), 10) || 20, 1), 100);

  if (cursor) {
    try {
      const cursorId = Buffer.from(cursor, "base64").toString();
      if (!/^[a-fA-F0-9]{24}$/.test(cursorId)) throw new Error('invalid cursor');
      const lastId = new ObjectId(cursorId);
      q._id = { $lt: lastId };
    } catch {
      return reply.code(400).send({ error: "invalid cursor" });
    }
  }

  const items = await scans.find(q).sort({ _id: -1 }).limit(pageSize).toArray();

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
  if (!/^[a-fA-F0-9]{24}$/.test(scan_id)) {
    return reply.status(400).send({ error: "invalid scan id" });
  }
  const user = (req as any).user;
  const doc = await scans.findOne({ _id: new ObjectId(scan_id), user_id: user.sub });

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

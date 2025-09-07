import Fastify from "fastify";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../config/.env") });

const app = Fastify();

const mongo = new MongoClient(process.env.MONGO_URI || "mongodb://localhost:27017");

app.get("/history", async (req, reply) => {
  const { limit = "20", cursor, type, risk } = req.query as any;
  const db = mongo.db(process.env.MONGO_DB || "forgeharbor");
  const scans = db.collection("scans");

  const q: any = {};
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

// Temporary debug probe — run from repo root in the SAME shell where the curl worked:
//   node scripts/probe-mantle.mjs
// Uses OPENAI_BASE_URL and BEDROCK_API_KEY from the environment. Delete after debugging.
import OpenAI from "openai";

const baseURL = process.env.OPENAI_BASE_URL;
const apiKey = process.env.BEDROCK_API_KEY;
if (!baseURL || !apiKey) {
  console.error("Set OPENAI_BASE_URL and BEDROCK_API_KEY first.");
  process.exit(1);
}
console.log(`baseURL=${baseURL} keyPrefix=${apiKey.slice(0, 8)}… keyLen=${apiKey.length}`);

const client = new OpenAI({ apiKey, baseURL });
try {
  const r = await client.responses.create({
    model: "openai.gpt-5.4",
    instructions: "You are helpful.",
    input: "Say: ready",
  });
  console.log("SDK OK:", JSON.stringify(r.output?.[0]?.content?.[0]?.text ?? r.output_text));
} catch (e) {
  console.error("SDK FAILED:", e.status, e.message);
}

const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
const OPENAI_MODEL = process.env.OPENAI_MODEL || process.env.OPENAI_LOCAL_MODEL || "gpt-5.4";

function getRuntimeOpenAIKey(env = process.env) {
  return String(env.OPENAI_TOKEN || env.OPENAI_API_KEY || "").trim();
}

function getRuntimeOpenAIModel(env = process.env) {
  return String(env.OPENAI_LOCAL_MODEL || env.OPENAI_MODEL || OPENAI_MODEL).trim() || OPENAI_MODEL;
}

const globals = {
  AWS_REGION,
  OPENAI_MODEL,
};

export { AWS_REGION, OPENAI_MODEL, getRuntimeOpenAIKey, getRuntimeOpenAIModel };
export default globals;

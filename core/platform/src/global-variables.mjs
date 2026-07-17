const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
const OPENAI_MODEL = process.env.OPENAI_MODEL || process.env.OPENAI_LOCAL_MODEL || "gpt-5.4";

const globals = {
  AWS_REGION,
  OPENAI_MODEL,
};

export { AWS_REGION, OPENAI_MODEL };
export default globals;

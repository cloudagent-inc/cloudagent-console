// Curated model choices so users never have to know about wire protocols or
// Bedrock endpoint shapes. Each preset maps to the provider/protocol/model
// fields the local LLM settings endpoint understands; the manual fields below
// the dropdown stay editable for anything not listed here.
export const CUSTOM_PRESET_ID = 'custom-manual';

const VERIFY_MODEL_NOTE = 'Verify the model ID in your AWS account';

export const MODEL_PRESETS = [
  {
    id: 'openai-gpt-5-6-sol',
    label: 'GPT-5.6 Sol (OpenAI API)',
    group: 'OpenAI',
    provider: 'openai',
    model: 'gpt-5.6-sol',
    keyHint: 'OpenAI API key',
  },
  {
    id: 'openai-gpt-5-6-terra',
    label: 'GPT-5.6 Terra (OpenAI API)',
    group: 'OpenAI',
    provider: 'openai',
    model: 'gpt-5.6-terra',
    keyHint: 'OpenAI API key',
  },
  {
    id: 'openai-gpt-5-6-luna',
    label: 'GPT-5.6 Luna (OpenAI API)',
    group: 'OpenAI',
    provider: 'openai',
    model: 'gpt-5.6-luna',
    keyHint: 'OpenAI API key',
  },
  {
    id: 'openai-gpt-5-4',
    label: 'GPT-5.4 (OpenAI API)',
    group: 'OpenAI',
    provider: 'openai',
    model: 'gpt-5.4',
    keyHint: 'OpenAI API key',
  },
  {
    id: 'anthropic-claude-opus-5',
    label: 'Claude Opus 5 (Anthropic API)',
    group: 'Anthropic',
    provider: 'anthropic',
    model: 'claude-opus-5',
    keyHint: 'Anthropic API key',
  },
  {
    id: 'anthropic-claude-sonnet-5',
    label: 'Claude Sonnet 5 (Anthropic API)',
    group: 'Anthropic',
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    keyHint: 'Anthropic API key',
  },
  {
    id: 'anthropic-claude-opus-4-8',
    label: 'Claude Opus 4.8 (Anthropic API)',
    group: 'Anthropic',
    provider: 'anthropic',
    model: 'claude-opus-4-8',
    keyHint: 'Anthropic API key',
  },
  {
    id: 'bedrock-gpt-5-6-sol',
    label: 'GPT-5.6 Sol (Bedrock Mantle)',
    group: 'AWS Bedrock',
    provider: 'bedrock',
    protocol: 'openai-responses',
    region: 'us-east-1',
    model: 'openai.gpt-5.6-sol',
    keyHint: 'Bedrock API key',
  },
  {
    id: 'bedrock-gpt-5-6-terra',
    label: 'GPT-5.6 Terra (Bedrock Mantle)',
    group: 'AWS Bedrock',
    provider: 'bedrock',
    protocol: 'openai-responses',
    region: 'us-east-1',
    model: 'openai.gpt-5.6-terra',
    keyHint: 'Bedrock API key',
  },
  {
    id: 'bedrock-gpt-5-6-luna',
    label: 'GPT-5.6 Luna (Bedrock Mantle)',
    group: 'AWS Bedrock',
    provider: 'bedrock',
    protocol: 'openai-responses',
    region: 'us-east-1',
    model: 'openai.gpt-5.6-luna',
    keyHint: 'Bedrock API key',
  },
  {
    id: 'bedrock-gpt-5-5',
    label: 'GPT-5.5 (Bedrock Mantle)',
    group: 'AWS Bedrock',
    provider: 'bedrock',
    protocol: 'openai-responses',
    region: 'us-east-1',
    model: 'openai.gpt-5.5',
    keyHint: 'Bedrock API key',
    note: 'Served from us-east-1 / us-east-2',
  },
  {
    id: 'bedrock-gpt-5-4',
    label: 'GPT-5.4 (Bedrock Mantle)',
    group: 'AWS Bedrock',
    provider: 'bedrock',
    protocol: 'openai-responses',
    region: 'us-east-2',
    model: 'openai.gpt-5.4',
    keyHint: 'Bedrock API key',
    note: 'Served from us-east-2 / us-west-2',
  },
  {
    id: 'bedrock-gpt-oss-120b',
    label: 'GPT-OSS 120B (Bedrock)',
    group: 'AWS Bedrock',
    provider: 'bedrock',
    protocol: 'openai-chat',
    region: 'us-east-1',
    model: 'openai.gpt-oss-120b-1:0',
    keyHint: 'Bedrock API key',
  },
  {
    id: 'bedrock-claude-sonnet-5',
    label: 'Claude Sonnet 5 (Bedrock Mantle)',
    group: 'AWS Bedrock',
    provider: 'bedrock',
    protocol: 'anthropic-messages',
    region: 'us-east-1',
    model: 'anthropic.claude-sonnet-5',
    keyHint: 'Bedrock API key',
  },
  {
    id: 'bedrock-claude-opus-4-8',
    label: 'Claude Opus 4.8 (Bedrock Mantle)',
    group: 'AWS Bedrock',
    provider: 'bedrock',
    protocol: 'anthropic-messages',
    region: 'us-east-1',
    model: 'anthropic.claude-opus-4-8',
    keyHint: 'Bedrock API key',
  },
  {
    id: 'bedrock-llama-4-maverick',
    label: 'Llama 4 Maverick (Bedrock)',
    group: 'AWS Bedrock',
    provider: 'bedrock',
    protocol: 'bedrock-converse',
    region: 'us-east-1',
    model: 'us.meta.llama4-maverick-17b-instruct-v1:0',
    keyHint: 'Bedrock API key or AWS credentials',
    note: VERIFY_MODEL_NOTE,
  },
  {
    id: 'bedrock-llama-3-3-70b',
    label: 'Llama 3.3 70B (Bedrock)',
    group: 'AWS Bedrock',
    provider: 'bedrock',
    protocol: 'bedrock-converse',
    region: 'us-east-1',
    model: 'us.meta.llama3-3-70b-instruct-v1:0',
    keyHint: 'Bedrock API key or AWS credentials',
    note: VERIFY_MODEL_NOTE,
  },
  {
    // Per the AWS model card, DeepSeek's chat-completions path is the Mantle
    // /v1 endpoint (not bedrock-runtime /openai/v1), so this preset carries an
    // explicit base URL; the save-time probe confirms the protocol.
    id: 'bedrock-deepseek-v3-2',
    label: 'DeepSeek V3.2 (Bedrock Mantle)',
    group: 'AWS Bedrock',
    provider: 'custom',
    baseUrl: 'https://bedrock-mantle.us-east-1.api.aws/v1',
    model: 'deepseek.v3.2',
    keyHint: 'Bedrock API key',
  },
  {
    id: CUSTOM_PRESET_ID,
    label: 'Custom configuration',
    group: 'Other',
  },
];

// Groups in catalog order, for grouped Select rendering.
export const MODEL_PRESET_GROUPS = MODEL_PRESETS.reduce((groups, preset) => {
  const group = groups.find((entry) => entry.label === preset.group);
  if (group) group.presets.push(preset);
  else groups.push({ label: preset.group, presets: [preset] });
  return groups;
}, []);

export function getPresetById(id) {
  return MODEL_PRESETS.find((preset) => preset.id === id) || null;
}

// A preset matches on provider + model, plus protocol when the preset pins one
// (bedrock serves the same model over several wire protocols).
export function findMatchingPreset({ provider, protocol, model } = {}) {
  const nextProvider = String(provider || '').trim().toLowerCase();
  const nextProtocol = String(protocol || '').trim().toLowerCase();
  const nextModel = String(model || '').trim();
  if (!nextProvider || !nextModel) return null;
  return (
    MODEL_PRESETS.find((preset) => {
      if (preset.id === CUSTOM_PRESET_ID) return false;
      if (preset.provider !== nextProvider || preset.model !== nextModel) return false;
      return !preset.protocol || preset.protocol === nextProtocol;
    }) || null
  );
}

// Returns the form patch for a preset, or null for the manual sentinel (which
// leaves every field untouched).
export function applyPreset(preset) {
  if (!preset || preset.id === CUSTOM_PRESET_ID) return null;
  return {
    provider: preset.provider,
    protocol: preset.protocol,
    model: preset.model,
    region: preset.region || '',
    baseUrl: preset.baseUrl || '',
  };
}

export function describeBedrockEndpoint(protocol) {
  switch (protocol) {
    case 'openai-responses':
      return 'Bedrock Mantle (OpenAI Responses API)';
    case 'anthropic-messages':
      return 'Bedrock Mantle (Anthropic Messages API)';
    case 'bedrock-converse':
      return 'Bedrock Converse API';
    case 'openai-chat':
      return 'Bedrock Runtime (OpenAI-compatible API)';
    default:
      return '';
  }
}

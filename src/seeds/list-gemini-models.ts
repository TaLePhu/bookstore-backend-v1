import { getEnv } from '@config/env';

interface ModelItem {
  name?: string;
  supportedGenerationMethods?: string[];
}

interface ListModelsResponse {
  models?: ModelItem[];
}

async function listModels(): Promise<void> {
  const env = getEnv();
  const apiKey = env.gemini.apiKey;
  const apiVersion = env.gemini.apiVersion || 'v1';

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing');
  }

  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${apiKey}`;
  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`List models failed: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as ListModelsResponse;
  const models = payload.models ?? [];

  if (models.length === 0) {
    console.log('No models returned.');
    return;
  }

  const embedModels = models
    .filter((model) => model.supportedGenerationMethods?.includes('embedContent'))
    .map((model) => model.name)
    .filter((name): name is string => Boolean(name));

  const generateModels = models
    .filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
    .map((model) => model.name)
    .filter((name): name is string => Boolean(name));

  console.log('Models supporting embedContent:');
  for (const name of embedModels) {
    console.log(`- ${name}`);
  }

  console.log('\nModels supporting generateContent:');
  for (const name of generateModels) {
    console.log(`- ${name}`);
  }
}

listModels().catch((error) => {
  console.error('Failed to list models:', error);
  process.exit(1);
});

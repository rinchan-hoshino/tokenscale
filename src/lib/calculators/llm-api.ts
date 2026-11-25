import pricing from '../../data/pricing-2026.json';

export interface LlmApiInput {
  dailyRequests: number;
  systemPromptTokens: number;
  dynamicInputTokens: number;
  outputTokens: number;
  cacheHitRate: number; // 0 to 0.95
  reasoningMultiplier: number; // 1.0 to 5.0
  useBatchApi: boolean;
}

export interface LlmModelCost {
  id: string;
  name: string;
  provider: string;
  tier: string;
  isReasoning: boolean;
  monthlyInputCost: number;
  monthlyCachedCost: number;
  monthlyOutputCost: number;
  monthlyTotal: number;
  monthlyWithoutCache: number;
  cacheSavingsUsd: number;
  costPer1kRequests: number;
}

export interface LlmApiResult {
  monthlyRequests: number;
  monthlyInputTokensM: number;
  monthlyOutputTokensM: number;
  models: LlmModelCost[];
  cheapestModel: LlmModelCost;
  flagshipModel: LlmModelCost;
  cacheSensitivity: {
    cacheRates: number[];
    series: {
      id: string;
      name: string;
      costs: number[];
    }[];
  };
}

export const LLM_API_PRESETS: Record<string, LlmApiInput> = {
  mvp: {
    dailyRequests: 2500,
    systemPromptTokens: 1500,
    dynamicInputTokens: 600,
    outputTokens: 450,
    cacheHitRate: 0.60,
    reasoningMultiplier: 1.5,
    useBatchApi: false,
  },
  scaleup: {
    dailyRequests: 45000,
    systemPromptTokens: 3200,
    dynamicInputTokens: 1200,
    outputTokens: 700,
    cacheHitRate: 0.75,
    reasoningMultiplier: 2.0,
    useBatchApi: false,
  },
  enterprise: {
    dailyRequests: 350000,
    systemPromptTokens: 6000,
    dynamicInputTokens: 2000,
    outputTokens: 900,
    cacheHitRate: 0.85,
    reasoningMultiplier: 2.5,
    useBatchApi: true,
  },
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));
}

export function calculateLlmApiCost(raw: LlmApiInput): LlmApiResult {
  const dailyRequests = clamp(raw.dailyRequests, 1, 10_000_000);
  const systemPromptTokens = clamp(raw.systemPromptTokens, 0, 200_000);
  const dynamicInputTokens = clamp(raw.dynamicInputTokens, 0, 200_000);
  const outputTokens = clamp(raw.outputTokens, 1, 100_000);
  const cacheHitRate = clamp(raw.cacheHitRate, 0, 0.95);
  const reasoningMultiplier = clamp(raw.reasoningMultiplier, 1, 10);
  const useBatchApi = Boolean(raw.useBatchApi);

  const monthlyRequests = dailyRequests * 30;
  const totalInputPerReq = systemPromptTokens + dynamicInputTokens;
  const monthlyInputTokensM = (monthlyRequests * totalInputPerReq) / 1_000_000;
  const monthlyOutputTokensM = (monthlyRequests * outputTokens) / 1_000_000;

  const computeForModel = (m: (typeof pricing.llmApiModels)[number], hitRate: number): LlmModelCost => {
    const discount = useBatchApi && m.supportsBatch ? m.batchDiscount : 1.0;
    const cachedSystemTokensM = (monthlyRequests * systemPromptTokens * hitRate) / 1_000_000;
    const uncachedInputTokensM =
      (monthlyRequests * (systemPromptTokens * (1 - hitRate) + dynamicInputTokens)) / 1_000_000;
    const effectiveOutputTokensM =
      (monthlyRequests * outputTokens * (m.isReasoning ? reasoningMultiplier : 1.0)) / 1_000_000;

    const monthlyInputCost = uncachedInputTokensM * m.inputPer1M * discount;
    const monthlyCachedCost = cachedSystemTokensM * m.cachedInputPer1M * discount;
    const monthlyOutputCost = effectiveOutputTokensM * m.outputPer1M * discount;
    const monthlyTotal = monthlyInputCost + monthlyCachedCost + monthlyOutputCost;

    const monthlyWithoutCache =
      (monthlyInputTokensM * m.inputPer1M + effectiveOutputTokensM * m.outputPer1M) * discount;
    const cacheSavingsUsd = Math.max(0, monthlyWithoutCache - monthlyTotal);
    const costPer1kRequests = (monthlyTotal / monthlyRequests) * 1000;

    return {
      id: m.id,
      name: m.name,
      provider: m.provider,
      tier: m.tier,
      isReasoning: m.isReasoning,
      monthlyInputCost,
      monthlyCachedCost,
      monthlyOutputCost,
      monthlyTotal,
      monthlyWithoutCache,
      cacheSavingsUsd,
      costPer1kRequests,
    };
  };

  const models = pricing.llmApiModels
    .map((m) => computeForModel(m, cacheHitRate))
    .sort((a, b) => a.monthlyTotal - b.monthlyTotal);

  const cheapestModel = models[0];
  const flagshipModel = models.find((m) => m.id === 'claude-sonnet-4.5') ?? models[models.length - 1];

  const cacheRates = [0, 0.25, 0.5, 0.75, 0.95];
  const sensitivityIds = ['claude-sonnet-4.5', 'gpt-4.1', 'gemini-2.5-pro', 'gpt-4.1-mini'];
  const series = sensitivityIds
    .map((id) => pricing.llmApiModels.find((m) => m.id === id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
    .map((m) => ({
      id: m.id,
      name: m.name,
      costs: cacheRates.map((r) => computeForModel(m, r).monthlyTotal),
    }));

  return {
    monthlyRequests,
    monthlyInputTokensM,
    monthlyOutputTokensM,
    models,
    cheapestModel,
    flagshipModel,
    cacheSensitivity: {
      cacheRates,
      series,
    },
  };
}

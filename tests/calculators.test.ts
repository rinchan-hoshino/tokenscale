import { describe, it, expect } from 'vitest';
import { calculateLlmApiCost, LLM_API_PRESETS } from '../src/lib/calculators/llm-api';
import { calculateLlmVram, LLM_VRAM_PRESETS } from '../src/lib/calculators/llm-vram';
import { calculateGpuBreakeven, GPU_BREAKEVEN_PRESETS } from '../src/lib/calculators/gpu-vs-api';
import { calculateCloudEgress, CLOUD_EGRESS_PRESETS } from '../src/lib/calculators/cloud-egress';
import { calculateRagVectorCost, RAG_VECTOR_PRESETS } from '../src/lib/calculators/rag-vector';
import { calculateVoiceAiCost, VOICE_AI_PRESETS } from '../src/lib/calculators/voice-ai';
import pricing from '../src/data/pricing-2026.json';
import { buildMarkdownTable } from '../src/lib/format';

describe('1. LLM API & Prompt Caching Simulator', () => {
  it('computes positive costs and sorts ascending', () => {
    const res = calculateLlmApiCost(LLM_API_PRESETS.scaleup);
    expect(res.models.length).toBe(pricing.llmApiModels.length);
    expect(res.models.length).toBe(17);
    expect(res.cheapestModel.monthlyTotal).toBeGreaterThan(0);
    for (let i = 1; i < res.models.length; i++) {
      expect(res.models[i].monthlyTotal).toBeGreaterThanOrEqual(res.models[i - 1].monthlyTotal);
    }
  });

  it('higher prompt cache hit rate monotonically reduces cost for caching models', () => {
    const lowCache = calculateLlmApiCost({ ...LLM_API_PRESETS.scaleup, cacheHitRate: 0 });
    const highCache = calculateLlmApiCost({ ...LLM_API_PRESETS.scaleup, cacheHitRate: 0.9 });
    const sonnetLow = lowCache.models.find((m) => m.id === 'claude-sonnet-5.5')!;
    const sonnetHigh = highCache.models.find((m) => m.id === 'claude-sonnet-5.5')!;
    expect(sonnetHigh.monthlyTotal).toBeLessThan(sonnetLow.monthlyTotal);
    expect(sonnetHigh.cacheSavingsUsd).toBeGreaterThan(0);
  });

  it('batch API applies per-model batch discount (50% off for GPT-6.2 Sol, 20% off for Grok 4.7)', () => {
    const regular = calculateLlmApiCost({ ...LLM_API_PRESETS.mvp, useBatchApi: false });
    const batch = calculateLlmApiCost({ ...LLM_API_PRESETS.mvp, useBatchApi: true });
    const gptReg = regular.models.find((m) => m.id === 'gpt-6.2-sol')!;
    const gptBatch = batch.models.find((m) => m.id === 'gpt-6.2-sol')!;
    expect(gptBatch.monthlyTotal).toBeCloseTo(gptReg.monthlyTotal * 0.5, 4);

    const grokReg = regular.models.find((m) => m.id === 'grok-4.7')!;
    const grokBatch = batch.models.find((m) => m.id === 'grok-4.7')!;
    expect(grokBatch.monthlyTotal).toBeCloseTo(grokReg.monthlyTotal * 0.8, 4);
  });

  it('applies long-context pricing tiers (>100K for Claude Haiku 5.5, >=200K for Grok 4.7)', () => {
    const shortHaiku = calculateLlmApiCost({
      ...LLM_API_PRESETS.mvp,
      systemPromptTokens: 100_000,
      dynamicInputTokens: 0,
      cacheHitRate: 0,
    }).models.find((m) => m.id === 'claude-haiku-5.5')!;
    const longHaiku = calculateLlmApiCost({
      ...LLM_API_PRESETS.mvp,
      systemPromptTokens: 100_000,
      dynamicInputTokens: 1,
      cacheHitRate: 0,
    }).models.find((m) => m.id === 'claude-haiku-5.5')!;
    expect(longHaiku.monthlyTotal).toBeGreaterThan(shortHaiku.monthlyTotal * 4.9);

    const shortGrok = calculateLlmApiCost({
      ...LLM_API_PRESETS.mvp,
      systemPromptTokens: 199_999,
      dynamicInputTokens: 0,
      cacheHitRate: 0,
    }).models.find((m) => m.id === 'grok-4.7')!;
    const longGrok = calculateLlmApiCost({
      ...LLM_API_PRESETS.mvp,
      systemPromptTokens: 200_000,
      dynamicInputTokens: 0,
      cacheHitRate: 0,
    }).models.find((m) => m.id === 'grok-4.7')!;
    expect(longGrok.monthlyTotal).toBeGreaterThan(shortGrok.monthlyTotal * 1.9);
  });
});

describe('2. Local LLM GPU VRAM & KV-Cache Simulator', () => {
  it('scales VRAM monotonically with context length and concurrency', () => {
    const base = calculateLlmVram(LLM_VRAM_PRESETS.mvp);
    const longCtx = calculateLlmVram({ ...LLM_VRAM_PRESETS.mvp, contextLength: 65536 });
    const highBatch = calculateLlmVram({ ...LLM_VRAM_PRESETS.mvp, concurrentSeqs: 16 });
    expect(longCtx.kvCacheGB).toBeGreaterThan(base.kvCacheGB * 7);
    expect(highBatch.kvCacheGB).toBeGreaterThan(base.kvCacheGB * 7);
    expect(longCtx.totalVramGB).toBeGreaterThan(base.totalVramGB);
  });

  it('Q4_K_M uses significantly less weight VRAM than FP16', () => {
    const fp16 = calculateLlmVram({ ...LLM_VRAM_PRESETS.scaleup, quantizationId: 'FP16' });
    const q4 = calculateLlmVram({ ...LLM_VRAM_PRESETS.scaleup, quantizationId: 'Q4_K_M' });
    expect(q4.weightsGB).toBeLessThan(fp16.weightsGB * 0.35);
  });

  it('matches hardware profiles and computes positive tok/s', () => {
    const res = calculateLlmVram(LLM_VRAM_PRESETS.mvp);
    expect(res.hardwareMatches.length).toBeGreaterThanOrEqual(8);
    expect(res.recommendedHardware.estimatedTokPerSec).toBeGreaterThan(10);
  });
});

describe('3. Self-Hosted GPU vs Managed API Break-Even Simulator', () => {
  it('identifies API cheaper at low volume and GPU cheaper at high volume', () => {
    const low = calculateGpuBreakeven({ ...GPU_BREAKEVEN_PRESETS.scaleup, dailyTokensM: 2 });
    const high = calculateGpuBreakeven({ ...GPU_BREAKEVEN_PRESETS.scaleup, dailyTokensM: 120 });
    expect(low.winner).toBe('Managed API');
    expect(high.winner).toBe('Self-Hosted GPU');
    expect(high.breakevenDailyTokensM).not.toBeNull();
    expect(high.breakevenDailyTokensM!).toBeGreaterThan(2);
    expect(high.breakevenDailyTokensM!).toBeLessThan(120);
  });

  it('higher utilization increases single-GPU daily token capacity', () => {
    const lowUtil = calculateGpuBreakeven({ ...GPU_BREAKEVEN_PRESETS.scaleup, gpuUtilizationPct: 20 });
    const highUtil = calculateGpuBreakeven({ ...GPU_BREAKEVEN_PRESETS.scaleup, gpuUtilizationPct: 80 });
    expect(highUtil.singleGpuCapacityDailyM).toBeCloseTo(lowUtil.singleGpuCapacityDailyM * 4, 2);
  });
});

describe('4. Cloud Object Storage & Egress Comparator', () => {
  it('keeps Cloudflare R2 egress at zero regardless of egress volume', () => {
    const res = calculateCloudEgress(CLOUD_EGRESS_PRESETS.enterprise);
    const r2 = res.providers.find((p) => p.id === 'cloudflare-r2')!;
    const s3 = res.providers.find((p) => p.id === 'aws-s3-cf')!;
    expect(r2.egressUsd).toBe(0);
    expect(s3.egressUsd).toBeGreaterThan(30_000);
    expect(r2.totalUsd).toBeLessThan(s3.totalUsd);
  });

  it('applies Backblaze B2 3x free egress allowance correctly', () => {
    const withinFree = calculateCloudEgress({ storageTB: 10, egressTB: 25, classAMillions: 1, classBMillions: 10 });
    const aboveFree = calculateCloudEgress({ storageTB: 10, egressTB: 50, classAMillions: 1, classBMillions: 10 });
    const b2Free = withinFree.providers.find((p) => p.id === 'backblaze-b2')!;
    const b2Paid = aboveFree.providers.find((p) => p.id === 'backblaze-b2')!;
    expect(b2Free.egressUsd).toBe(0);
    expect(b2Paid.egressUsd).toBeGreaterThan(0);
  });
});

describe('5. RAG Vector Database & Embedding Simulator', () => {
  it('scalar and binary quantization compress vector memory footprint', () => {
    const fp32 = calculateRagVectorCost({ ...RAG_VECTOR_PRESETS.scaleup, quantization: 'fp32' });
    const int8 = calculateRagVectorCost({ ...RAG_VECTOR_PRESETS.scaleup, quantization: 'int8' });
    const bin = calculateRagVectorCost({ ...RAG_VECTOR_PRESETS.scaleup, quantization: 'binary' });
    expect(int8.quantizedVectorsGB).toBeLessThan(fp32.quantizedVectorsGB);
    expect(bin.quantizedVectorsGB).toBeLessThan(int8.quantizedVectorsGB);
    expect(bin.compressionRatio).toBeGreaterThan(int8.compressionRatio);
  });

  it('higher QPS increases compute/query cost across providers', () => {
    const lowQps = calculateRagVectorCost({ ...RAG_VECTOR_PRESETS.scaleup, queryQps: 5 });
    const highQps = calculateRagVectorCost({ ...RAG_VECTOR_PRESETS.scaleup, queryQps: 300 });
    const pineLow = lowQps.providers.find((p) => p.id === 'pinecone-serverless')!;
    const pineHigh = highQps.providers.find((p) => p.id === 'pinecone-serverless')!;
    expect(pineHigh.monthlyTotalUsd).toBeGreaterThan(pineLow.monthlyTotalUsd);
  });
});

describe('6. Realtime Voice AI Pipeline Simulator', () => {
  it('higher VAD silence trimming monotonically reduces AI voice cost', () => {
    const noTrim = calculateVoiceAiCost({ ...VOICE_AI_PRESETS.scaleup, silenceTrimPct: 0 });
    const trim40 = calculateVoiceAiCost({ ...VOICE_AI_PRESETS.scaleup, silenceTrimPct: 40 });
    const oaiNoTrim = noTrim.pipelines.find((p) => p.id === 'gpt-realtime-2.1')!;
    const oaiTrim = trim40.pipelines.find((p) => p.id === 'gpt-realtime-2.1')!;
    expect(oaiTrim.totalPerMin).toBeLessThan(oaiNoTrim.totalPerMin);
  });

  it('scales monthly bill linearly with daily calls', () => {
    const small = calculateVoiceAiCost({ ...VOICE_AI_PRESETS.mvp, dailyCalls: 100 });
    const big = calculateVoiceAiCost({ ...VOICE_AI_PRESETS.mvp, dailyCalls: 1000 });
    expect(big.cheapest.monthlyTotalUsd).toBeCloseTo(small.cheapest.monthlyTotalUsd * 10, 4);
  });
});

describe('7. Markdown Export & Backlink Formatter', () => {
  it('renders right-aligned numeric columns, escapes pipes, and appends TokenScale backlink', () => {
    const md = buildMarkdownTable(
      'LLM API Cost',
      ['Model', 'Monthly Total'],
      [['GPT-6.2 Sol | Batch', '$1,200']],
      'https://rinchan-hoshino.github.io/tokenscale/llm-api-cost-calculator/?dailyRequests=45000',
      [1]
    );
    expect(md).toContain('### LLM API Cost');
    expect(md).toContain('| :--- | ---: |');
    expect(md).toContain('| GPT-6.2 Sol \\| Batch | $1,200 |');
    expect(md).toContain('*Simulated with [TokenScale](https://rinchan-hoshino.github.io/tokenscale/llm-api-cost-calculator/?dailyRequests=45000)*');
  });
});

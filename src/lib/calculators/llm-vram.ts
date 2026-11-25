import pricing from '../../data/pricing-2026.json';

export interface LlmVramInput {
  modelId: string;
  paramsB: number;
  activeParamsB: number;
  layers: number;
  kvHeads: number;
  headDim: number;
  quantizationId: string;
  contextLength: number; // 2048 to 131072
  concurrentSeqs: number; // 1 to 64
  kvPrecisionId: string;
}

export interface HardwareMatch {
  id: string;
  name: string;
  category: string;
  vramGB: number;
  bandwidthGBs: number;
  hourlyCloudUsd: number | null;
  headroomGB: number;
  utilizationPct: number;
  fitStatus: 'Fits' | 'Tight' | 'Multi-GPU';
  gpusRequired: number;
  estimatedTokPerSec: number;
}

export interface LlmVramResult {
  weightsGB: number;
  kvCacheGB: number;
  overheadGB: number;
  totalVramGB: number;
  activeWeightsGB: number;
  kvPerTokenKB: number;
  hardwareMatches: HardwareMatch[];
  recommendedHardware: HardwareMatch;
}

export const LLM_VRAM_PRESETS: Record<string, LlmVramInput> = {
  mvp: {
    modelId: 'llama-3.1-8b',
    paramsB: 8.0,
    activeParamsB: 8.0,
    layers: 32,
    kvHeads: 8,
    headDim: 128,
    quantizationId: 'Q4_K_M',
    contextLength: 8192,
    concurrentSeqs: 2,
    kvPrecisionId: 'FP16',
  },
  scaleup: {
    modelId: 'qwen-2.5-32b',
    paramsB: 32.8,
    activeParamsB: 32.8,
    layers: 64,
    kvHeads: 8,
    headDim: 128,
    quantizationId: 'FP8',
    contextLength: 32768,
    concurrentSeqs: 8,
    kvPrecisionId: 'FP8',
  },
  enterprise: {
    modelId: 'llama-3.3-70b',
    paramsB: 70.6,
    activeParamsB: 70.6,
    layers: 80,
    kvHeads: 8,
    headDim: 128,
    quantizationId: 'FP8',
    contextLength: 65536,
    concurrentSeqs: 16,
    kvPrecisionId: 'FP8',
  },
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));
}

export function calculateLlmVram(raw: LlmVramInput): LlmVramResult {
  const paramsB = clamp(raw.paramsB, 0.5, 1000);
  const activeParamsB = clamp(raw.activeParamsB, 0.5, paramsB);
  const layers = clamp(Math.round(raw.layers), 1, 256);
  const kvHeads = clamp(Math.round(raw.kvHeads), 1, 128);
  const headDim = clamp(Math.round(raw.headDim), 32, 512);
  const contextLength = clamp(raw.contextLength, 512, 262144);
  const concurrentSeqs = clamp(Math.round(raw.concurrentSeqs), 1, 256);

  const quant = pricing.quantizations.find((q) => q.id === raw.quantizationId) ?? pricing.quantizations[2];
  const kvPrec = pricing.kvPrecisions.find((k) => k.id === raw.kvPrecisionId) ?? pricing.kvPrecisions[0];

  // Weights in GiB (1e9 params * bytes / 1024^3)
  const GIB = 1024 ** 3;
  const weightsGB = (paramsB * 1e9 * quant.bytesPerParam) / GIB;
  const activeWeightsGB = (activeParamsB * 1e9 * quant.bytesPerParam) / GIB;

  // KV Cache: 2 (K and V) * layers * kvHeads * headDim * bytesPerElement * contextLength * concurrentSeqs
  const kvBytesPerToken = 2 * layers * kvHeads * headDim * kvPrec.bytesPerElement;
  const kvPerTokenKB = kvBytesPerToken / 1024;
  const kvCacheGB = (kvBytesPerToken * contextLength * concurrentSeqs) / GIB;

  // CUDA context + activation workspace overhead (~0.8 GiB base + 6% of weights + small batch scaling)
  const overheadGB = 0.8 + weightsGB * 0.06 + concurrentSeqs * 0.04;
  const totalVramGB = weightsGB + kvCacheGB + overheadGB;

  const hardwareMatches: HardwareMatch[] = pricing.hardwareProfiles.map((hw) => {
    const headroomGB = hw.vramGB - totalVramGB;
    const utilizationPct = (totalVramGB / hw.vramGB) * 100;
    const gpusRequired = Math.max(1, Math.ceil(totalVramGB / (hw.vramGB * 0.92)));

    let fitStatus: HardwareMatch['fitStatus'] = 'Fits';
    if (totalVramGB > hw.vramGB) {
      fitStatus = 'Multi-GPU';
    } else if (utilizationPct > 88) {
      fitStatus = 'Tight';
    }

    // Memory-bandwidth bound decode throughput estimate (single-stream tok/s = 0.72 * BW / activeWeightsGB)
    // Scale slightly down with concurrency per-user, or report aggregate decode bandwidth efficiency
    const effectiveBw = hw.bandwidthGBs * (fitStatus === 'Multi-GPU' ? gpusRequired * 0.82 : 1.0);
    const bytesReadPerTokenGB = Math.max(0.5, activeWeightsGB + kvCacheGB / Math.max(1, concurrentSeqs) * 0.25);
    const estimatedTokPerSec = Math.max(1, (effectiveBw * 0.72) / bytesReadPerTokenGB);

    return {
      id: hw.id,
      name: hw.name,
      category: hw.category,
      vramGB: hw.vramGB,
      bandwidthGBs: hw.bandwidthGBs,
      hourlyCloudUsd: hw.hourlyCloudUsd,
      headroomGB,
      utilizationPct,
      fitStatus,
      gpusRequired,
      estimatedTokPerSec,
    };
  });

  const recommendedHardware =
    hardwareMatches.find((h) => h.fitStatus === 'Fits') ??
    hardwareMatches.find((h) => h.fitStatus === 'Tight') ??
    hardwareMatches[hardwareMatches.length - 1];

  return {
    weightsGB,
    kvCacheGB,
    overheadGB,
    totalVramGB,
    activeWeightsGB,
    kvPerTokenKB,
    hardwareMatches,
    recommendedHardware,
  };
}

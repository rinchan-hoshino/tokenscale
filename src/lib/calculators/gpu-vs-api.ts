import pricing from '../../data/pricing-2026.json';

export interface GpuBreakevenInput {
  dailyTokensM: number; // Millions of total tokens per day (1 to 500)
  inputSharePct: number; // 10 to 95 (% of tokens that are input)
  gpuUtilizationPct: number; // 10 to 90 (% average utilization of provisioned GPU)
  gpuProfileId: string;
  gpuHourlyUsd: number;
  gpuPeakTokPerSec: number;
  apiInputPer1M: number;
  apiOutputPer1M: number;
}

export interface BreakevenPoint {
  dailyTokensM: number;
  apiMonthlyUsd: number;
  gpuMonthlyUsd: number;
  gpusNeeded: number;
}

export interface GpuBreakevenResult {
  blendedApiPer1M: number;
  monthlyApiUsd: number;
  monthlyGpuUsd: number;
  gpusRequired: number;
  monthlySavingsUsd: number; // positive means GPU is cheaper, negative means API is cheaper
  winner: 'Self-Hosted GPU' | 'Managed API';
  breakevenDailyTokensM: number | null;
  singleGpuCapacityDailyM: number;
  curve: BreakevenPoint[];
}

export const GPU_BREAKEVEN_PRESETS: Record<string, GpuBreakevenInput> = {
  mvp: {
    dailyTokensM: 8,
    inputSharePct: 75,
    gpuUtilizationPct: 35,
    gpuProfileId: 'l40s-48',
    gpuHourlyUsd: 1.14,
    gpuPeakTokPerSec: 720,
    apiInputPer1M: 0.40,
    apiOutputPer1M: 1.60,
  },
  scaleup: {
    dailyTokensM: 65,
    inputSharePct: 70,
    gpuUtilizationPct: 55,
    gpuProfileId: 'h100-sxm',
    gpuHourlyUsd: 2.69,
    gpuPeakTokPerSec: 1850,
    apiInputPer1M: 2.00,
    apiOutputPer1M: 8.00,
  },
  enterprise: {
    dailyTokensM: 280,
    inputSharePct: 75,
    gpuUtilizationPct: 70,
    gpuProfileId: 'h100-sxm',
    gpuHourlyUsd: 2.69,
    gpuPeakTokPerSec: 1850,
    apiInputPer1M: 3.00,
    apiOutputPer1M: 15.00,
  },
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));
}

export function calculateGpuBreakeven(raw: GpuBreakevenInput): GpuBreakevenResult {
  const dailyTokensM = clamp(raw.dailyTokensM, 0.1, 2000);
  const inputShare = clamp(raw.inputSharePct, 10, 95) / 100;
  const outputShare = 1 - inputShare;
  const utilization = clamp(raw.gpuUtilizationPct, 5, 95) / 100;
  const gpuHourlyUsd = clamp(raw.gpuHourlyUsd, 0.05, 50);
  const gpuPeakTokPerSec = clamp(raw.gpuPeakTokPerSec, 50, 20000);
  const apiInputPer1M = clamp(raw.apiInputPer1M, 0.01, 100);
  const apiOutputPer1M = clamp(raw.apiOutputPer1M, 0.01, 200);

  const blendedApiPer1M = inputShare * apiInputPer1M + outputShare * apiOutputPer1M;
  const HOURS_PER_MONTH = 730;
  const singleGpuMonthlyUsd = gpuHourlyUsd * HOURS_PER_MONTH;

  // Effective daily token capacity per GPU at the given average utilization
  const singleGpuCapacityDailyM = (gpuPeakTokPerSec * 86400 * utilization) / 1_000_000;

  const evalAtVolume = (volM: number): BreakevenPoint => {
    const apiMonthlyUsd = volM * 30 * blendedApiPer1M;
    const gpusNeeded = Math.max(1, Math.ceil(volM / singleGpuCapacityDailyM));
    const gpuMonthlyUsd = gpusNeeded * singleGpuMonthlyUsd;
    return {
      dailyTokensM: volM,
      apiMonthlyUsd,
      gpuMonthlyUsd,
      gpusNeeded,
    };
  };

  const current = evalAtVolume(dailyTokensM);
  const monthlySavingsUsd = current.apiMonthlyUsd - current.gpuMonthlyUsd;
  const winner: GpuBreakevenResult['winner'] =
    current.gpuMonthlyUsd < current.apiMonthlyUsd ? 'Self-Hosted GPU' : 'Managed API';

  // Exact crossover where 1 GPU becomes cheaper than API:
  // vol * 30 * blendedApiPer1M = singleGpuMonthlyUsd  =>  vol = singleGpuMonthlyUsd / (30 * blendedApiPer1M)
  const rawCrossover = singleGpuMonthlyUsd / (30 * blendedApiPer1M);
  // Check if GPU actually has lower unit cost than API at full capacity
  const gpuUnitCostPer1M = singleGpuMonthlyUsd / (singleGpuCapacityDailyM * 30);
  const breakevenDailyTokensM = gpuUnitCostPer1M < blendedApiPer1M ? rawCrossover : null;

  // Build curve spanning 0 to max(dailyTokensM * 1.8, crossover * 2.2)
  const maxX = Math.max(
    dailyTokensM * 1.8,
    breakevenDailyTokensM ? breakevenDailyTokensM * 2.2 : dailyTokensM * 1.8,
    10
  );
  const steps = 24;
  const curve: BreakevenPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const v = (maxX * i) / steps;
    curve.push(evalAtVolume(Math.max(0.1, v)));
  }

  return {
    blendedApiPer1M,
    monthlyApiUsd: current.apiMonthlyUsd,
    monthlyGpuUsd: current.gpuMonthlyUsd,
    gpusRequired: current.gpusNeeded,
    monthlySavingsUsd,
    winner,
    breakevenDailyTokensM,
    singleGpuCapacityDailyM,
    curve,
  };
}

export { pricing };

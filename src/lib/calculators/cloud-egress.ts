import pricing from '../../data/pricing-2026.json';

export interface CloudEgressInput {
  storageTB: number; // 0.5 to 500 TB
  egressTB: number; // 0 to 500 TB/month
  classAMillions: number; // 0.1 to 100 M writes/list per month
  classBMillions: number; // 1 to 500 M reads/gets per month
}

export interface CloudProviderCost {
  id: string;
  name: string;
  storageUsd: number;
  egressUsd: number;
  opsUsd: number;
  totalUsd: number;
  effectivePerTBEgress: number;
}

export interface CloudEgressResult {
  providers: CloudProviderCost[];
  cheapest: CloudProviderCost;
  mostExpensive: CloudProviderCost;
  maxMonthlySavingsUsd: number;
  cliffSeries: {
    egressAxisTB: number[];
    series: {
      id: string;
      name: string;
      costs: number[];
    }[];
  };
}

export const CLOUD_EGRESS_PRESETS: Record<string, CloudEgressInput> = {
  mvp: {
    storageTB: 5,
    egressTB: 15,
    classAMillions: 1,
    classBMillions: 15,
  },
  scaleup: {
    storageTB: 40,
    egressTB: 120,
    classAMillions: 8,
    classBMillions: 90,
  },
  enterprise: {
    storageTB: 250,
    egressTB: 450,
    classAMillions: 40,
    classBMillions: 350,
  },
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));
}

export function calculateCloudEgress(raw: CloudEgressInput): CloudEgressResult {
  const storageTB = clamp(raw.storageTB, 0.1, 10_000);
  const egressTB = clamp(raw.egressTB, 0, 10_000);
  const classAMillions = clamp(raw.classAMillions, 0, 5000);
  const classBMillions = clamp(raw.classBMillions, 0, 20_000);

  const storageGB = storageTB * 1000;

  const evalProvider = (
    p: (typeof pricing.cloudStorageProviders)[number],
    egressValTB: number
  ): CloudProviderCost => {
    const egressGB = egressValTB * 1000;
    const freeEgressGB = storageGB * p.freeEgressMultiplierOfStorage;
    const billableEgressGB = Math.max(0, egressGB - freeEgressGB);

    const storageUsd = storageGB * p.storagePerGBMonth;
    const egressUsd = billableEgressGB * p.egressPerGB;
    const opsUsd = classAMillions * p.classAPer1M + classBMillions * p.classBPer1M;
    const totalUsd = storageUsd + egressUsd + opsUsd;
    const effectivePerTBEgress = egressValTB > 0 ? egressUsd / egressValTB : 0;

    return {
      id: p.id,
      name: p.name,
      storageUsd,
      egressUsd,
      opsUsd,
      totalUsd,
      effectivePerTBEgress,
    };
  };

  const providers = pricing.cloudStorageProviders
    .map((p) => evalProvider(p, egressTB))
    .sort((a, b) => a.totalUsd - b.totalUsd);

  const cheapest = providers[0];
  const mostExpensive = providers[providers.length - 1];
  const maxMonthlySavingsUsd = Math.max(0, mostExpensive.totalUsd - cheapest.totalUsd);

  const maxEgressPlot = Math.max(20, Math.ceil(egressTB * 2));
  const steps = 10;
  const egressAxisTB = Array.from({ length: steps + 1 }, (_, i) =>
    Math.round(((maxEgressPlot * i) / steps) * 10) / 10
  );

  const series = pricing.cloudStorageProviders.map((p) => ({
    id: p.id,
    name: p.name,
    costs: egressAxisTB.map((eg) => evalProvider(p, eg).totalUsd),
  }));

  return {
    providers,
    cheapest,
    mostExpensive,
    maxMonthlySavingsUsd,
    cliffSeries: {
      egressAxisTB,
      series,
    },
  };
}

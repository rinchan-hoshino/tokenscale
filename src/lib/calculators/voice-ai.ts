import pricing from '../../data/pricing-2026.json';

export interface VoiceAiInput {
  dailyCalls: number; // 50 to 50,000
  avgCallMinutes: number; // 1 to 30
  silenceTrimPct: number; // 0 to 60 (% of audio trimmed by VAD)
  includeTelephony: boolean;
}

export interface VoicePipelineCost {
  id: string;
  name: string;
  architecture: 'Cascaded' | 'Native S2S';
  sttPerMin: number;
  llmPerMin: number;
  ttsPerMin: number;
  telephonyPerMin: number;
  totalPerMin: number;
  monthlyTotalUsd: number;
}

export interface VoiceAiResult {
  monthlyCalls: number;
  monthlyMinutes: number;
  activeSpeechFactor: number;
  pipelines: VoicePipelineCost[];
  cheapest: VoicePipelineCost;
  mostExpensive: VoicePipelineCost;
  savingsPct: number;
}

export const VOICE_AI_PRESETS: Record<string, VoiceAiInput> = {
  mvp: {
    dailyCalls: 200,
    avgCallMinutes: 4.5,
    silenceTrimPct: 25,
    includeTelephony: true,
  },
  scaleup: {
    dailyCalls: 3500,
    avgCallMinutes: 6.0,
    silenceTrimPct: 30,
    includeTelephony: true,
  },
  enterprise: {
    dailyCalls: 25000,
    avgCallMinutes: 7.5,
    silenceTrimPct: 35,
    includeTelephony: true,
  },
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));
}

export function calculateVoiceAiCost(raw: VoiceAiInput): VoiceAiResult {
  const dailyCalls = clamp(Math.round(raw.dailyCalls), 1, 1_000_000);
  const avgCallMinutes = clamp(raw.avgCallMinutes, 0.5, 120);
  const silenceTrimPct = clamp(raw.silenceTrimPct, 0, 70);
  const includeTelephony = Boolean(raw.includeTelephony);

  const monthlyCalls = dailyCalls * 30;
  const monthlyMinutes = monthlyCalls * avgCallMinutes;
  const activeSpeechFactor = 1 - silenceTrimPct / 100;
  const telephonyPerMin = includeTelephony ? pricing.voiceAiPricing.telephonyPerMin : 0;

  // Assume 50/50 split between user speaking and agent speaking during active audio
  const userShare = 0.5;
  const agentShare = 0.5;

  const cascaded: VoicePipelineCost[] = pricing.voiceAiPricing.cascadedStacks.map((s) => {
    const sttPerMin = s.sttPerMin * activeSpeechFactor;
    const llmPerMin = s.llmPerMin * activeSpeechFactor;
    const ttsPerMin = s.ttsPerMin * activeSpeechFactor;
    const totalPerMin = sttPerMin + llmPerMin + ttsPerMin + telephonyPerMin;
    return {
      id: s.id,
      name: s.name,
      architecture: 'Cascaded',
      sttPerMin,
      llmPerMin,
      ttsPerMin,
      telephonyPerMin,
      totalPerMin,
      monthlyTotalUsd: totalPerMin * monthlyMinutes,
    };
  });

  const realtime: VoicePipelineCost[] = pricing.voiceAiPricing.realtimeModels.map((r) => {
    // Native S2S bills audio input + audio output on active speech
    const sttPerMin = r.audioInputPerMin * activeSpeechFactor * userShare;
    const llmPerMin = 0; // bundled into S2S audio tokens
    const ttsPerMin = r.audioOutputPerMin * activeSpeechFactor * agentShare;
    const totalPerMin = sttPerMin + llmPerMin + ttsPerMin + telephonyPerMin;
    return {
      id: r.id,
      name: r.name,
      architecture: 'Native S2S',
      sttPerMin,
      llmPerMin,
      ttsPerMin,
      telephonyPerMin,
      totalPerMin,
      monthlyTotalUsd: totalPerMin * monthlyMinutes,
    };
  });

  const pipelines = [...cascaded, ...realtime].sort((a, b) => a.monthlyTotalUsd - b.monthlyTotalUsd);
  const cheapest = pipelines[0];
  const mostExpensive = pipelines[pipelines.length - 1];
  const savingsPct =
    mostExpensive.monthlyTotalUsd > 0
      ? ((mostExpensive.monthlyTotalUsd - cheapest.monthlyTotalUsd) / mostExpensive.monthlyTotalUsd) * 100
      : 0;

  return {
    monthlyCalls,
    monthlyMinutes,
    activeSpeechFactor,
    pipelines,
    cheapest,
    mostExpensive,
    savingsPct,
  };
}

import pricing from '../../data/pricing-2026.json';

export type VectorQuantization = 'fp32' | 'int8' | 'binary';

export interface RagVectorInput {
  documents: number; // 1,000 to 50,000,000
  avgTokensPerDoc: number; // 200 to 10,000
  chunkSizeTokens: number; // 256 to 2048
  chunkOverlapPct: number; // 0 to 30
  dimensions: 768 | 1536 | 3072;
  quantization: VectorQuantization;
  monthlyUpdatePct: number; // 1 to 50
  queryQps: number; // 1 to 500
}

export interface VectorDbCost {
  id: string;
  name: string;
  indexRamGB: number;
  storageCostUsd: number;
  computeQueryUsd: number;
  embeddingRefreshUsd: number;
  monthlyTotalUsd: number;
}

export interface RagVectorResult {
  chunksPerDoc: number;
  totalVectors: number;
  rawVectorsGB: number;
  quantizedVectorsGB: number;
  compressionRatio: number;
  initialEmbeddingUsd: number;
  monthlyEmbeddingRefreshUsd: number;
  monthlyQueriesM: number;
  providers: VectorDbCost[];
  cheapest: VectorDbCost;
}

export const RAG_VECTOR_PRESETS: Record<string, RagVectorInput> = {
  mvp: {
    documents: 50_000,
    avgTokensPerDoc: 1200,
    chunkSizeTokens: 512,
    chunkOverlapPct: 15,
    dimensions: 1536,
    quantization: 'fp32',
    monthlyUpdatePct: 10,
    queryQps: 5,
  },
  scaleup: {
    documents: 1_000_000,
    avgTokensPerDoc: 1500,
    chunkSizeTokens: 512,
    chunkOverlapPct: 15,
    dimensions: 1536,
    quantization: 'int8',
    monthlyUpdatePct: 12,
    queryQps: 45,
  },
  enterprise: {
    documents: 10_000_000,
    avgTokensPerDoc: 2000,
    chunkSizeTokens: 512,
    chunkOverlapPct: 10,
    dimensions: 3072,
    quantization: 'binary',
    monthlyUpdatePct: 15,
    queryQps: 200,
  },
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));
}

export function calculateRagVectorCost(raw: RagVectorInput): RagVectorResult {
  const documents = clamp(Math.round(raw.documents), 100, 100_000_000);
  const avgTokensPerDoc = clamp(raw.avgTokensPerDoc, 100, 50_000);
  const chunkSizeTokens = clamp(raw.chunkSizeTokens, 128, 4096);
  const chunkOverlapPct = clamp(raw.chunkOverlapPct, 0, 40);
  const dimensions = ([768, 1536, 3072].includes(raw.dimensions) ? raw.dimensions : 1536) as
    | 768
    | 1536
    | 3072;
  const monthlyUpdatePct = clamp(raw.monthlyUpdatePct, 0, 100);
  const queryQps = clamp(raw.queryQps, 0.5, 5000);

  const stride = Math.max(64, chunkSizeTokens * (1 - chunkOverlapPct / 100));
  const chunksPerDoc = Math.max(1, Math.ceil(avgTokensPerDoc / stride));
  const totalVectors = documents * chunksPerDoc;

  const GIB = 1024 ** 3;
  const rawBytesPerVector = dimensions * 4; // FP32 = 4 bytes
  const quantBytesPerVector =
    raw.quantization === 'binary'
      ? dimensions / 8
      : raw.quantization === 'int8'
      ? dimensions * 1
      : rawBytesPerVector;

  const metadataBytesPerVector = 256; // IDs + JSON payload filter keys
  const rawVectorsGB = (totalVectors * (rawBytesPerVector + metadataBytesPerVector)) / GIB;
  const quantizedVectorsGB = (totalVectors * (quantBytesPerVector + metadataBytesPerVector)) / GIB;
  const compressionRatio = rawVectorsGB / Math.max(0.0001, quantizedVectorsGB);

  const totalTokensM = (totalVectors * chunkSizeTokens) / 1_000_000;
  const initialEmbeddingUsd = totalTokensM * pricing.ragVectorPricing.embeddingPer1MTokens;
  const monthlyEmbeddingRefreshUsd = initialEmbeddingUsd * (monthlyUpdatePct / 100);

  const SECONDS_PER_MONTH = 30 * 86400;
  const monthlyQueriesM = (queryQps * SECONDS_PER_MONTH) / 1_000_000;
  const monthlyUpdatedVectorsM = (totalVectors * (monthlyUpdatePct / 100)) / 1_000_000;

  const providers: VectorDbCost[] = pricing.ragVectorPricing.providers
    .map((p) => {
      const indexRamGB = quantizedVectorsGB * p.hnswOverheadMultiplier;
      let storageCostUsd = 0;
      let computeQueryUsd = 0;

      if (p.id === 'pinecone-serverless') {
        storageCostUsd = indexRamGB * p.storageCostPerGBMonth;
        // Pinecone Serverless read units scale gently with namespace size (~1 RU per 100k vectors scanned, min 1)
        const ruPerQuery = Math.max(1, Math.log10(Math.max(10, totalVectors / 10_000)));
        const readUnitsM = monthlyQueriesM * ruPerQuery;
        const writeUnitsM = monthlyUpdatedVectorsM * 2;
        computeQueryUsd =
          readUnitsM * (p.readUnitPer1M ?? 8.25) + writeUnitsM * (p.writeUnitPer1M ?? 2.0);
      } else {
        const ramCost = indexRamGB * (p.ramCostPerGBMonth ?? 6.0);
        const diskCost = indexRamGB * 1.5 * p.storageCostPerGBMonth;
        storageCostUsd = ramCost + diskCost;

        const qpsCap = p.qpsCapacityPerNode ?? 50;
        const extraNodes = Math.max(0, Math.ceil(queryQps / qpsCap) - 1);
        computeQueryUsd = p.baseMonthlyUsd + extraNodes * (p.extraNodeMonthlyUsd ?? 90);
      }

      const monthlyTotalUsd = storageCostUsd + computeQueryUsd + monthlyEmbeddingRefreshUsd;

      return {
        id: p.id,
        name: p.name,
        indexRamGB,
        storageCostUsd,
        computeQueryUsd,
        embeddingRefreshUsd: monthlyEmbeddingRefreshUsd,
        monthlyTotalUsd,
      };
    })
    .sort((a, b) => a.monthlyTotalUsd - b.monthlyTotalUsd);

  return {
    chunksPerDoc,
    totalVectors,
    rawVectorsGB,
    quantizedVectorsGB,
    compressionRatio,
    initialEmbeddingUsd,
    monthlyEmbeddingRefreshUsd,
    monthlyQueriesM,
    providers,
    cheapest: providers[0],
  };
}

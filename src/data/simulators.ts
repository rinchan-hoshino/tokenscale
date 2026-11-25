export interface SimulatorMeta {
  id: string;
  href: string;
  navLabel: string;
  title: string;
  shortDesc: string;
  ctaLabel: string;
}

export const SIMULATORS: SimulatorMeta[] = [
  {
    id: 'llm-api',
    href: '/llm-api-cost-calculator/',
    navLabel: 'LLM API',
    title: 'LLM API & Prompt Caching Cost Simulator',
    shortDesc:
      'Compare OpenAI, Anthropic, Gemini, DeepSeek, and Groq monthly spend with prompt cache hit rates, reasoning multipliers, and batch discounts.',
    ctaLabel: 'Open API simulator',
  },
  {
    id: 'llm-vram',
    href: '/llm-vram-calculator/',
    navLabel: 'GPU VRAM',
    title: 'Local LLM GPU VRAM & KV-Cache Sizing',
    shortDesc:
      'Model weight footprint, GQA KV-cache growth across 2K–128K context, quantization tiers, and memory-bandwidth tok/s across GPUs and Apple Silicon.',
    ctaLabel: 'Open VRAM simulator',
  },
  {
    id: 'gpu-breakeven',
    href: '/gpu-vs-api-breakeven/',
    navLabel: 'GPU vs API',
    title: 'Self-Hosted GPU vs Managed API Break-Even',
    shortDesc:
      'Find the exact daily token volume where renting dedicated H100, L40S, or RTX 4090 instances beats per-token managed APIs.',
    ctaLabel: 'Open break-even simulator',
  },
  {
    id: 'cloud-egress',
    href: '/cloud-egress-calculator/',
    navLabel: 'Cloud Egress',
    title: 'Cloud Object Storage & Egress Comparator',
    shortDesc:
      'Quantify the hyperscaler bandwidth cliff across Cloudflare R2, Backblaze B2, AWS S3 + CloudFront, and Google Cloud Storage.',
    ctaLabel: 'Open egress simulator',
  },
  {
    id: 'rag-vector',
    href: '/rag-vector-cost-calculator/',
    navLabel: 'RAG Vector',
    title: 'RAG Vector Database & Embedding Simulator',
    shortDesc:
      'Size chunk counts, HNSW memory with INT8 or binary quantization, and monthly QPS bills across pgvector, Qdrant, Pinecone, and Weaviate.',
    ctaLabel: 'Open RAG simulator',
  },
  {
    id: 'voice-ai',
    href: '/voice-ai-cost-calculator/',
    navLabel: 'Voice AI',
    title: 'Realtime Voice AI Pipeline Cost Simulator',
    shortDesc:
      'Compare cascaded STT + LLM + TTS pipelines against native Speech-to-Speech models with VAD silence trimming and telephony overhead.',
    ctaLabel: 'Open voice simulator',
  },
];

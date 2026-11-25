# TokenScale — Feature Map & Architecture

TokenScale is a 100% static, client-side AI & Cloud Infrastructure FinOps simulator suite built with Astro 5 and vanilla TypeScript. Zero backend, zero database, zero external CDN or font requests, deployed to GitHub Pages under `/tokenscale/`.

## Routes (8 Pages + SEO Assets under `/tokenscale/`)

| Route | Title | Engine | Charts & Interactive Features |
| :--- | :--- | :--- | :--- |
| `/tokenscale/` | Home & Quick Bench | `src/lib/calculators/llm-api.ts` | Immediate interactive LLM API quick bench + balanced 2×3 6-simulator matrix + mobile `<select>` nav switcher |
| `/tokenscale/llm-api-cost-calculator/` | LLM API & Prompt Caching Cost Simulator | `src/lib/calculators/llm-api.ts` | 10 models (GPT-4.1, GPT-4.1 mini, OpenAI o3, Claude Sonnet 4.5, Claude Haiku 4.5, Gemini 2.5 Pro/Flash, DeepSeek-V3/R1, Groq Llama 3.3 70B), prompt cache hit rate 0–95%, reasoning multiplier, Batch API 50% toggle, horizontal comparison bar + cache sensitivity SVG curve |
| `/llm-vram-calculator/` | Local LLM GPU VRAM, KV-Cache & Quantization Sizing | `src/lib/calculators/llm-vram.ts` | 7B–141B Dense & MoE presets + custom GQA geometry, FP16/BF16/FP8/Q8_0/Q6_K/Q4_K_M, 2K–128K context, concurrency, FP16/FP8/Q8 KV cache, stacked VRAM SVG bar + 9 GPU/Apple Silicon fit & tok/s table |
| `/gpu-vs-api-breakeven/` | Self-Hosted GPU vs Managed LLM API Break-Even | `src/lib/calculators/gpu-vs-api.ts` | Daily token volume, input/output split, GPU utilization %, H100/L40S/A100/RTX 4090 hourly presets, exact crossover annotation on dual-series SVG curve |
| `/cloud-egress-calculator/` | Cloud Object Storage & Egress Cost Comparator | `src/lib/calculators/cloud-egress.ts` | Cloudflare R2 ($0 egress), Backblaze B2 (3× free egress), AWS S3 + CloudFront, GCS; multi-line SVG egress cliff chart |
| `/rag-vector-cost-calculator/` | RAG Vector Database & Embedding Cost Simulator | `src/lib/calculators/rag-vector.ts` | Document count, chunk size/overlap, 768/1536/3072-d, FP32/INT8/Binary quantization, monthly churn, sustained QPS; stacked SVG breakdown across pgvector, Qdrant, Pinecone, Weaviate |
| `/voice-ai-cost-calculator/` | Realtime Voice AI Pipeline Cost Simulator | `src/lib/calculators/voice-ai.ts` | Daily calls, duration, VAD silence trimming %, telephony toggle; stacked per-minute SVG breakdown comparing cascaded STT+LLM+TTS vs native Speech-to-Speech |
| `/about/` | Methodology & Pricing Sources | `src/data/pricing-2026.json` | Dataset version transparency, unit conventions (GiB vs decimal TB), published rate snapshot |
| `/sitemap.xml` | Static XML Sitemap | `src/pages/sitemap.xml.ts` | Auto-generated sitemap covering all 8 routes |
| `/robots.txt` | Crawler Directives | `public/robots.txt` | Points crawlers to `/sitemap.xml` |

## Shared Capabilities Across All 6 Simulators

- **Centralized Pricing Single Source of Truth**: `src/data/pricing-2026.json` (update quarterly in < 5 minutes).
- **Segmented Workload Presets**: `Startup MVP`, `Scale-up SaaS`, `Enterprise Batch`.
- **Bidirectional Slider + Numeric Input Sync**: `font-variant-numeric: tabular-nums` prevents horizontal jitter.
- **Live URL Query Serialization**: `src/lib/url-state.ts` encodes every parameter into the URL for instant scenario sharing.
- **Pure Native Responsive SVG Charts**: `src/lib/svg-charts.ts` renders horizontal bars, stacked bars, and multi-series/crossover line charts with zero charting library bloat.
- **One-Click CSV Export**: `src/lib/format.ts` generates clean RFC-4180 CSV downloads for architecture reviews.
- **Structured SEO Metadata**: `SoftwareApplication` and `FAQPage` JSON-LD schemas on all 6 simulator pages.

## Verification & Quality Gates

- **Unit Tests**: `npm test` (Vitest) — 14 tests covering formula accuracy, boundary clamping, and monotonicity across all 6 engines.
- **Playwright Audit**: `npm run audit` (`scripts/audit-playwright.mjs`) — verifies HTTP 200 across all 8 routes + sitemap/robots, total gzipped JS `< 35KB`, zero console/page errors, zero external requests, zero broken internal links, zero horizontal overflow on `1440×900` and `390×844`, WCAG AA contrast `>= 4.5:1`, and live slider-to-SVG + URL query reactivity across all 6 simulators.

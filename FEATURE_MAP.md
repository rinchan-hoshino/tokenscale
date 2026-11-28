# TokenScale — Feature Map & Architecture

TokenScale is a 100% static, client-side AI & Cloud Infrastructure FinOps simulator suite built with Astro 5 and vanilla TypeScript. Zero backend, zero database, zero external CDN or font requests, deployed to GitHub Pages under `/tokenscale/`.

## Routes (8 Pages + SEO Assets under `/tokenscale/`)

| Route | Title | Engine | Charts & Interactive Features |
| :--- | :--- | :--- | :--- |
| `/tokenscale/` | Home & Quick Bench | `src/lib/calculators/llm-api.ts` | Immediate interactive LLM API quick bench + balanced 2×3 6-simulator matrix + mobile `<select>` nav switcher |
| `/tokenscale/llm-api-cost-calculator/` | LLM API & Prompt Caching Cost Simulator | `src/lib/calculators/llm-api.ts` | 17 models (GPT-6.2 Astra / Sol, GPT-6.1 Terra, GPT-6 Luna, Claude Fable 5.2 / Opus 5.5 / Sonnet 5.5 / Haiku 5.5, Gemini 4 Carbon / Neon / Hydrogen / 3.8 Flash / 3.5 Flash-Lite, DeepSeek V4 Pro / V4.1 Flash, Grok 4.7, Qwen 4 Max), prompt cache hit rate 0–95%, reasoning multiplier, Batch API toggle (50% / 20% per provider), long-context tier cliffs, horizontal comparison bar + cache sensitivity SVG curve |
| `/llm-vram-calculator/` | Local LLM GPU VRAM, KV-Cache & Quantization Sizing | `src/lib/calculators/llm-vram.ts` | 8B–552B Dense & MoE presets (Qwen3, Qwen3.8, Llama 4 Scout/Maverick, DeepSeek V4.1 Flash) + custom GQA geometry, FP16/BF16/FP8/Q8_0/Q6_K/Q4_K_M, 2K–128K context, concurrency, FP16/FP8/Q8 KV cache, stacked VRAM SVG bar + 12 GPU/Apple Silicon fit & tok/s table |
| `/gpu-vs-api-breakeven/` | Self-Hosted GPU vs Managed LLM API Break-Even | `src/lib/calculators/gpu-vs-api.ts` | Daily token volume, input/output split, GPU utilization %, B200/H200/H100/L40S/A100/RTX 4090 hourly presets, exact crossover annotation on dual-series SVG curve |
| `/cloud-egress-calculator/` | Cloud Object Storage & Egress Cost Comparator | `src/lib/calculators/cloud-egress.ts` | Cloudflare R2 ($0 egress), Backblaze B2 (3× free egress), AWS S3 + CloudFront, GCS; multi-line SVG egress cliff chart |
| `/rag-vector-cost-calculator/` | RAG Vector Database & Embedding Cost Simulator | `src/lib/calculators/rag-vector.ts` | Document count, chunk size/overlap, 768/1536/3072-d, FP32/INT8/Binary quantization, monthly churn, sustained QPS; stacked SVG breakdown across pgvector, Qdrant, Pinecone, Weaviate |
| `/voice-ai-cost-calculator/` | Realtime Voice AI Pipeline Cost Simulator | `src/lib/calculators/voice-ai.ts` | Daily calls, duration, VAD silence trimming %, telephony toggle; stacked per-minute SVG breakdown comparing cascaded STT+LLM+TTS vs native Speech-to-Speech |
| `/about/` | Methodology & Pricing Sources | `src/data/pricing-2026.json` | Dataset version transparency, unit conventions (GiB vs decimal TB), published rate snapshot |
| `/sitemap.xml` | Static XML Sitemap | `src/pages/sitemap.xml.ts` | Auto-generated sitemap covering all 8 routes (`lastmod` synced with `pricing-2026.json`) |
| `/robots.txt` | Crawler Directives | `public/robots.txt` | Points crawlers to `/sitemap.xml` |
| `/og-card.png` | Social Preview Card | `scripts/generate-og-card.mjs` | Crisp `1200×630` engineering FinOps Open Graph & Twitter `summary_large_image` card |

## Shared Capabilities Across All 6 Simulators

- **Centralized Pricing Single Source of Truth**: `src/data/pricing-2026.json` (update quarterly in < 5 minutes).
- **Segmented Workload Presets**: `Startup MVP`, `Scale-up SaaS`, `Enterprise Batch`.
- **Bidirectional Slider + Numeric Input Sync**: `font-variant-numeric: tabular-nums` prevents horizontal jitter.
- **Live URL Query Serialization**: `src/lib/url-state.ts` encodes every parameter into the URL for instant scenario sharing.
- **Frameless Embed Mode (`?embed=1`) + One-Click `Copy Embed`**: Hides site navigation, docs, and footer to render a compact iframe-ready workbench with a live `Powered by TokenScale ↗` attribution link that carries user-modified parameters to the full page.
- **One-Click GitHub/ADR Markdown Export (`Copy Markdown`)**: Copies a formatted Markdown comparison table with a natural `*Simulated with [TokenScale](...)*` backlink containing the live scenario URL (available on all 6 simulators and the Home Quick Bench).
- **Pure Native Responsive SVG Charts**: `src/lib/svg-charts.ts` renders horizontal bars, stacked bars, and multi-series/crossover line charts with zero charting library bloat.
- **One-Click CSV Export**: `src/lib/format.ts` generates clean RFC-4180 CSV downloads for architecture reviews.
- **Structured SEO & Social Metadata**: `SoftwareApplication` + `FAQPage` JSON-LD schemas plus full `og:image` (`1200×630`) and `twitter:card` tags on all pages.

## Verification & Quality Gates

- **Unit Tests**: `npm test` (Vitest) — 16 tests covering formula accuracy, long-context cliffs, per-model batch discounts, boundary clamping, monotonicity across all 6 engines, and Markdown export backlink formatting.
- **Playwright Audit**: `npm run audit` (`scripts/audit-playwright.mjs`) — verifies HTTP 200 across all 8 routes + sitemap/robots/og-card, total gzipped JS `< 35KB`, zero console/page errors, zero external requests, zero broken internal links, zero horizontal overflow on `1440×900`, `390×844`, and `?embed=1`, `Copy Markdown` & `Copy Embed` clipboard output, and live slider-to-SVG + URL query reactivity across all 6 simulators.

/**
 * Client-side narrative overrides for projects whose structured_narrative
 * hasn't been written to Supabase yet (e.g. due to RLS policies).
 *
 * These are keyed by project slug and merged in ProjectPage.tsx.
 * Once the DB column is populated, the override becomes a no-op
 * (the DB value takes precedence since we only apply when null).
 */
import type { StructuredNarrative } from '@/types'

export const narrativeOverrides: Record<string, StructuredNarrative> = {
  'nexus-ds': {
    hook: 'What if data scientists could explore, clean, and train models without leaving the browser — and without uploading a single byte to the cloud?',
    problem: 'Data science workflows are fragmented across Jupyter notebooks, command-line tools, and cloud platforms. Getting from raw CSV to trained model requires context-switching between multiple tools, managing Python environments, and often uploading sensitive data to third-party services. For quick EDA and prototyping, this overhead kills velocity.',
    approach: 'Nexus DS is a browser-native data science workbench that handles the full pipeline: ingest any tabular dataset, explore it with auto-generated EDA charts, engineer features with AI-powered suggestions, configure and train ML models via a Python backend, and export cleaned data with auto-generated documentation — all from a single interface with zero cloud uploads.',
    results: [
      'Built a 106-component React application with 930KB of frontend source across 12 feature modules',
      'Implemented a full GPU-accelerated training pipeline via FastAPI backend with scikit-learn, XGBoost, and LightGBM',
      '20+ classification and regression algorithms available with auto-configured hyperparameter tuning',
      'Smart Feature Forge auto-detects encoding needs, skewness corrections, and datetime extractions with one-click application',
      'Real-time data quality scoring with outlier detection, missing value analysis, and PII scanning',
      'Client-side processing ensures complete data privacy — no data ever leaves the user\'s machine',
    ],
    learned: [
      'Designing a complex multi-step wizard (Configure → Algorithms → Tune → Train) with deep state management taught me the importance of clear data flow architecture',
      'Bridging browser-side data manipulation with a Python ML backend via WebSocket required careful serialization strategies for large datasets',
      'Building production-quality EDA from scratch (correlation matrices, box plots, distribution analysis) gave me deep appreciation for visualization libraries like Recharts',
    ],
    summary: 'Nexus DS is a privacy-first, browser-based data science workbench that replaces the Jupyter + cloud ML pipeline with a single, polished desktop application. It features automated EDA, intelligent feature engineering, a 20-algorithm Model Lab with GPU acceleration, and generates exportable Python code and data dictionaries.',
    metrics: [
      { label: 'Components', value: '106', context: 'files' },
      { label: 'Algorithms', value: '20', context: 'models' },
      { label: 'Data Sources', value: '8', context: 'types' },
      { label: 'Training', value: '6.5', context: 'seconds' },
    ],
    techHighlights: [
      'React 19 + Vite 7 with TanStack Table for virtualized rendering of 100K+ row datasets',
      'FastAPI WebSocket backend streams training progress in real-time to the browser',
      'Monaco Editor integration enables inline data transformations with full TypeScript intellisense',
      'TensorFlow.js fallback for in-browser model training when no Python backend is available',
      'Dual theme system (dark sage / light olive) with CSS variables and Framer Motion transitions',
    ],
    architecture: 'graph LR\n  A[Data Source] -->|Ingest| B[Browser Runtime]\n  B -->|EDA| C[Recharts]\n  B -->|Transform| D[Feature Forge]\n  D -->|Configure| E[Model Lab]\n  E -->|WebSocket| F[FastAPI Backend]\n  F -->|Stream| G[Results]\n  G -->|Export| H[CSV + Report]',
    pipelineSteps: [
      { label: 'Ingest', detail: 'Load CSV, Excel, Parquet, JSON, or use built-in sample datasets. Auto-detects column types and domain classification.' },
      { label: 'Explore', detail: 'Auto-generated EDA with box plots, histograms, correlation matrices, categorical distributions, and PCA/t-SNE projections.' },
      { label: 'Engineer', detail: 'Feature Forge suggests log transforms, one-hot encoding, datetime extractions, and interaction features based on data patterns.' },
      { label: 'Train', detail: 'Configure target, select from 20 algorithms across ensemble, boosting, linear, SVM, and instance-based families. GPU-accelerated via Python backend.' },
      { label: 'Evaluate', detail: 'Results leaderboard with accuracy, precision, recall, F1, feature importance charts, and AI-generated insights.' },
      { label: 'Export', detail: 'Download cleaned data, auto-generated data dictionary, reproducible Python training script, and PDF report.' },
    ],
    theme: {
      accent: '#7a9a65',
      accentAlt: '#5a8a6a',
      variant: 'dashboard',
    },
    demoVideo: '/demos/nexus-ds-demo.webp',
  },

  'sub-3b-vlm-comparison-for-industrial-auditing': {
    hook: 'Every sub-3B vision model we tested defaults to telling operators their factory is safe — even when pipes are corroded and gauges are redlined. We mapped exactly where and why each architecture breaks.',
    problem: 'Oil and gas plants run on thousands of legacy analog gauges and pipelines requiring manual inspection. Replacing them with digital sensors is cost-prohibitive. Vision-Language Models offer a retrofit solution, but cloud APIs are banned in industrial environments due to latency, connectivity, and data privacy regulations. Models must run locally on edge hardware under strict VRAM ceilings. No existing benchmark tests whether sub-3B VLMs can enforce Standard Operating Procedure (SOP) compliance — not just read a gauge, but compare the reading against a safety rule and output a constrained logic verdict.',
    approach: 'I built a research pipeline that subjects six edge-native VLMs (SmolVLM 0.6B, InternVL2 1B, Janus 1.3B, Gemma 4 2B, Qwen2-VL 2.2B, MiniCPM 2.8B) to a custom "Golden 100" benchmark with Constraint Injection — each image is evaluated against two mutually exclusive SOPs, forcing the model to reverse its verdict on the same image when the text rule changes. Across 15,000 evaluations with three deterministic passes per configuration, I tested zero-shot baselines against Chain-of-Thought, Rule Decomposition, dual-channel CLAHE optical preprocessing, Parameter-Efficient Fine-Tuning (LoRA), and a novel Agentic Foveation pipeline. All paired comparisons validated via McNemar\'s exact test.',
    results: [
      'Universal zero-shot failure: the entire sub-3B cohort exhibits structural Modality Collapse, defaulting to "safe" verdicts regardless of physical evidence (Pleasing Bias)',
      'Qwen2-VL peaks at 40% Logic Compliance Rate under Rule Decomposition — more than doubling its baseline (p < 0.0001) — the highest empirical ceiling achieved by any sub-3B model',
      'Chain-of-Thought actively degrades some architectures: imposing structured logic triggers the Formatting Penalty, causing SmolVLM to hit 100% FNR (complete modality collapse)',
      'LoRA fine-tuning makes logic WORSE: adapting Qwen2-VL\'s vision-language projector crashed Decomposition LCR from 40% to 14% (p = 0.0163) — Optimization Saturation',
      'Agentic Foveation fixes weak reasoning but causes Tunnel Vision: FPR spikes from 17.9% to 31.6% when peripheral context is stripped, inducing alarm fatigue',
      'Entire pipeline runs within 4.6 GB peak VRAM on consumer hardware — proving edge deployment is physically viable, but no model achieves autonomous-grade reliability',
    ],
    learned: [
      'The reasoning bottleneck in sub-3B VLMs is fundamentally linguistic, not visual — LoRA on the vision encoder cannot cure modality collapse because the failure happens at the language decoder level',
      'Reinforcement-learning alignment creates a structural "Pleasing Bias" in all frontier models — they are trained to be reassuring, which makes them actively dangerous for safety-critical auditing',
      'Rule Decomposition (fracturing SOPs into sequential binary checks) is the only intervention that reliably improves logic compliance without triggering catastrophic side effects like Tunnel Vision or Optimization Saturation',
    ],
    summary: 'A NeurIPS-format research paper evaluating six sub-3B Vision-Language Models for autonomous industrial safety auditing at the network edge. Through 15,000 evaluations across a custom Constraint Injection benchmark, we prove that all frontier architectures suffer from structural Modality Collapse under zero-shot deployment. We map the exact breaking points where Chain-of-Thought, optical preprocessing, LoRA fine-tuning, and spatial foveation each fail — and identify Rule Decomposition as the only viable path to logic compliance under strict 8GB VRAM constraints.',
    metrics: [
      { label: 'Models', value: '6', context: 'architectures' },
      { label: 'Evaluations', value: '15K', context: 'total inferences' },
      { label: 'Peak LCR', value: '40%', context: 'Qwen2-VL + Decomp' },
      { label: 'Peak VRAM', value: '4.6 GB', context: 'edge viable' },
      { label: 'McNemar', value: 'p<.0001', context: 'significance' },
      { label: 'Paper', value: 'NeurIPS', context: 'format' },
    ],
    screenshots: [
      { url: '/projects/vlm/baseline_danger_bar.png', caption: 'Zero-Shot Modality Collapse — All 6 models default to "safe" verdicts. LCR ranges from 10% (SmolVLM) to 27% (MiniCPM). FNR exceeds 70% across the board.' },
      { url: '/projects/vlm/modality_collapse_slope.png', caption: 'Formatting Penalty Slope — CoT improves some models but actively degrades others. SmolVLM hits 100% FNR under structured prompting. Janus breaks format entirely.' },
      { url: '/projects/vlm/foveation_vs_baseline.png', caption: 'Agentic Foveation vs Baseline — Spatial cropping fixes CoT (LCR 23%→33%, p=0.015) but causes Tunnel Vision under Decomposition (FPR spikes 17.9%→31.6%).' },
      { url: '/projects/vlm/foveation_demo.png', caption: 'Agentic Foveation Pipeline — Three-stage process: spatial localization → foveated cropping (1024×1024 upscale) → targeted reasoning on isolated anomaly.' },
      { url: '/projects/vlm/hardware_bubble_vram.png', caption: 'Edge Viability — All models fit within 8GB VRAM ceiling. Qwen2-VL peaks at 4.6 GB. Entire pipeline runs on consumer hardware without cloud APIs.' },
      { url: '/projects/vlm/gauge_sample.jpg', caption: 'Golden 100 — Analog gauge with specular glare and oblique angle. Models must extract the reading AND compare against a quantitative SOP threshold.' },
      { url: '/projects/vlm/pipe_corroded_sample.jpg', caption: 'Golden 100 — Corroded pipeline. Under Constraint Injection, the same image is evaluated against a strict SOP (UNSAFE) and a lenient SOP (SAFE).' },
      { url: '/projects/vlm/pipe_clean_sample.jpg', caption: 'Golden 100 — Non-corroded pipe. Texture overlap with corroded samples tests whether models rely on visual evidence or default to training priors.' },
    ],
    callouts: [
      {
        title: 'Universal Failure',
        value: 'All 6 models fail zero-shot',
        description: 'Under unconstrained deployment, every architecture — modular, decoupled, unified — suffers structural Modality Collapse. Models default to conversational "Pleasing Bias," assuming environments are safe regardless of physical evidence.',
        type: 'critical',
      },
      {
        title: 'Rule Decomposition Wins',
        value: 'Qwen2-VL: 19% → 40% LCR (p < 0.0001)',
        description: 'Fracturing SOPs into sequential binary checks is the only intervention that reliably doubles logic compliance without catastrophic side effects. It mimics a human inspector with a strict checklist.',
        type: 'success',
      },
      {
        title: 'LoRA Backfires',
        value: 'Decomp LCR crashes 40% → 14% (p = 0.016)',
        description: 'Fine-tuning the vision-language projector induces Optimization Saturation — catastrophic forgetting of logical reasoning pathways. The bottleneck is linguistic, not visual.',
        type: 'warning',
      },
      {
        title: 'Foveation Tradeoff',
        value: 'FPR spikes 17.9% → 31.6%',
        description: 'Spatial cropping fixes weak CoT reasoning but strips peripheral context, causing architectural Tunnel Vision. The model becomes hyper-vigilant — mistaking shadows for defects, inducing alarm fatigue.',
        type: 'info',
      },
    ],
    charts: [
      {
        type: 'horizontal-bar' as const,
        title: 'Zero-Shot Logic Compliance Rate (LCR) — All Models Fail',
        data: [
          { label: 'MiniCPM', value: 27.0, color: '#f59e0b' },
          { label: 'InternVL2', value: 25.0, color: '#f59e0b' },
          { label: 'Qwen2-VL', value: 19.0, color: '#ef4444' },
          { label: 'SmolVLM', value: 10.0, color: '#ef4444' },
          { label: 'Janus', value: 18.0, color: '#ef4444' },
          { label: 'Gemma 4', value: 16.0, color: '#ef4444' },
        ],
        valueFormat: 'percent' as const,
        xLabel: 'LCR % (higher = better)',
        insight: 'No model exceeds 27% logic compliance zero-shot. Models trained via RLHF default to "safe" verdicts — an 81% FNR means missing 8 of 10 real defects.',
      },
      {
        type: 'horizontal-bar' as const,
        title: 'Peak LCR After Rule Decomposition — The Ceiling',
        data: [
          { label: 'Qwen2-VL', value: 40.0, color: '#22c55e' },
          { label: 'InternVL2', value: 36.0, color: '#3b82f6' },
          { label: 'MiniCPM', value: 27.0, color: '#8b5cf6' },
          { label: 'Gemma 4', value: 22.7, color: '#f59e0b' },
          { label: 'SmolVLM', value: 18.0, color: '#ef4444' },
          { label: 'Janus', value: 14.0, color: '#ef4444' },
        ],
        valueFormat: 'percent' as const,
        xLabel: 'LCR % (higher = better)',
        insight: 'Rule Decomposition more than doubles Qwen2-VL\'s compliance (p < 0.0001). But even at 40%, 6 of 10 safety decisions are still wrong — confirming human-in-the-loop is mandatory.',
      },
    ],
    techHighlights: [
      'Custom Constraint Injection benchmark: same image evaluated against two mutually exclusive SOPs — true logic compliance requires reversing the verdict when the text rule changes',
      'Four architectural families tested: Projector-Based (SmolVLM, InternVL2, MiniCPM), Decoupled (Janus), Dynamic Resolution (Qwen2-VL), Unified Multimodal (Gemma 4)',
      '4-bit NF4 quantization via Bitsandbytes — peak 4.6 GB VRAM, entire pipeline fits within consumer 8GB GPU ceiling',
      'Three-stage Agentic Foveation pipeline: spatial localization → foveated crop (1024×1024 upscale with 15% padding) → targeted Rule Decomposition reasoning',
      'LoRA fine-tuning on vision encoder (blocks 21-23) + multimodal projector — 800 augmented samples, r=16, α=32 — proved Optimization Saturation hypothesis',
    ],
    architecture: '/projects/vlm/hardware_bubble_vram.png',
    pipelineSteps: [
      { label: 'Golden 100 Curation', detail: 'Hand-selected 50 analog gauges + 50 pipeline images from Roboflow datasets. Human-annotated ground truth with visual stressor tags (glare, oblique angles, obstructions). Synthesized into 200-row Constraint Injection matrix with dual opposing SOPs per image.' },
      { label: 'Zero-Shot Baseline', detail: 'All 6 models tested with raw images + full safety rules. Establishes base failure rate and maps universal Modality Collapse — the "Pleasing Bias" where RLHF-aligned models default to safe verdicts.' },
      { label: 'Linguistic Interventions', detail: 'Chain-of-Thought (forced step-by-step reasoning) and Rule Decomposition (SOPs fractured into sequential binary checks). Maps the "Formatting Penalty" — where structured prompts overwhelm sub-3B token capacity.' },
      { label: 'Optical Preprocessing', detail: 'Dual-channel CLAHE contrast enhancement isolates whether failures are visual (pixel crush) or logical (reasoning bottleneck). Proves the bottleneck is fundamentally linguistic.' },
      { label: 'Targeted Interventions', detail: 'LoRA fine-tuning (vision encoder + projector) and Agentic Foveation (spatial cropping pipeline) applied exclusively to Qwen2-VL — the highest-performing baseline. Both induce new failure modes.' },
      { label: 'Statistical Validation', detail: '15,000 evaluations across 3 deterministic passes. All paired comparisons validated via McNemar\'s exact test with multiple hypothesis correction. No single-run claims permitted.' },
    ],
    theme: {
      accent: '#d4a574',
      accentAlt: '#b8860b',
      variant: 'research',
    },
  },

  'lifeos-energy-first-productivity-for-adhd-neurodivergent-minds': {
    hook: 'A productivity system that doesn\'t adapt to your cognitive state is a system that will eventually burn you out. LifeOS treats your energy as the primary constraint — not your time.',
    problem: 'Every major productivity app — Notion, Todoist, TickTick, Motion — assumes a constant operator. They schedule, remind, and punish uniformly regardless of whether you\'re in deep focus or approaching burnout. For neurodivergent users and knowledge workers with executive function challenges, this rigidity creates a destructive cycle: the tool designed to help becomes another source of guilt. No existing product adapts its UI density, animation speed, typography, AI tone, and interaction patterns based on real-time cognitive state.',
    approach: 'I built LifeOS as a full-stack productivity operating system across a TurboRepo monorepo (web + mobile + desktop + AI agent). The core innovation is a neuro-adaptive engine: three cognitive themes (Focus, Calm, Rest) that swap 380+ CSS variables each — changing not just colors, but font families, animation speeds, touch target sizes, shadow systems, and AI personality. An 8-signal burnout detection algorithm with personal baselines monitors behavioral patterns passively, and the system intervenes before collapse — not after.',
    results: [
      'Ships on 3 platforms (Web, iOS/Android, Desktop) from a single monorepo — shared design system, auth, and data layer across all surfaces',
      '14 integrated modules: Tasks, Habits, Goals, Journal, Notes, Focus Timer, Calendar, Vision Board, Weekly Review, Rituals, Protocol Hub, Economy, Insights, and Onboarding',
      '12 AI-powered features including a circadian-aware Day Planner that schedules around your energy peaks, NLP task parsing, and a conversational Cortex assistant with theme-adaptive personality',
      '3 neuro-adaptive themes that change everything — typography, animation speed, touch targets, shadow depth, and AI tone — with zero-flash transitions and full reduced-motion support',
      'P2P device sync with end-to-end encryption — your data syncs directly between devices without passing through any cloud server',
      'Additive-only gamification — XP engine with no punishment mechanics, streak freezes, recovery bonuses, and a virtual economy with equippable effects',
    ],
    learned: [
      'Neuro-adaptive theming requires going far beyond color palettes — each cognitive mode needs its own typography, animation timing, information density, and interaction speed to meaningfully change how the product feels',
      'Burnout detection needs false-positive guards as much as sensitivity — personal baselines, minimum data maturity windows, and momentum exceptions prevent the system from crying wolf on light days or weekends',
      'Building P2P sync without a server is an end-to-end engineering challenge — from signaling and NAT traversal to conflict resolution strategies and compressed delta payloads',
    ],
    summary: 'LifeOS is a neuro-adaptive productivity operating system shipping on web, mobile, and desktop from a single monorepo. It features 3 cognitive themes that adapt the entire UI to your energy level, behavioral burnout detection with personal baselines, 12 AI-powered features including circadian-aware day planning, P2P encrypted device sync, and a premium design system with clay surfaces, glassmorphism, and theme-aware micro-animations.',
    metrics: [
      { label: 'Platforms', value: '3', context: 'Web, Mobile, Desktop' },
      { label: 'Modules', value: '14', context: 'integrated' },
      { label: 'AI Features', value: '12', context: 'Gemini-powered' },
      { label: 'Themes', value: '3', context: 'neuro-adaptive' },
      { label: 'Widgets', value: '20', context: 'customizable' },
      { label: 'Task Views', value: '5', context: 'List to Kanban' },
    ],

    demoUrl: 'https://lifeos.vc',
    screenshots: [
      { url: '/projects/lifeos/hero.png', caption: '"Energy. Not Lists." — LifeOS landing page with Focus / Calm / Rest mode toggle. The entire product adapts to your cognitive state.' },
      { url: '/projects/lifeos/rest_mode.png', caption: 'Rest Mode — Quick wins, breathing exercises, motivational quotes, and a gentle timer. The UI physically slows down with longer animations and softer shapes.' },
    ],

    callouts: [
      {
        title: 'Neuro-Adaptive Engine',
        value: '3 cognitive modes',
        description: 'Focus (monospace, fast animations, high contrast), Calm (serif, warm gradients, frosted glass), Rest (larger touch targets, slower animations, softer shapes). The entire UI adapts — not just the color palette.',
        type: 'info',
      },
      {
        title: 'Burnout Detection',
        value: 'Multi-signal behavioral analysis',
        description: 'Weighted composite scorer monitoring task patterns, habit erosion, session quality, journal sentiment, and energy trends. Uses personal baselines with false-positive suppression — not fixed thresholds.',
        type: 'warning',
      },
      {
        title: 'P2P Encrypted Sync',
        value: 'Zero cloud middleman',
        description: 'WebRTC-based device-to-device sync with QR code pairing, end-to-end encryption, visual verification, and conflict resolution. Your productivity data never leaves your devices.',
        type: 'success',
      },
      {
        title: 'Recovery-First Design',
        value: 'No punishment mechanics',
        description: 'Rest mode triggers guided breathing, stretch animations, micro-recovery cards, and One Thing Mode. Streak freezes instead of resets. Recovery bonuses for coming back. AI in Rest mode never suggests adding more work.',
        type: 'critical',
      },
    ],

    techHighlights: [
      'Monorepo architecture shipping web (Next.js 14), mobile (Capacitor), and desktop (Electron) from shared packages — one design system, one auth flow, one data layer',
      'Custom CSS design system with clay extrusion shadows, glassmorphism, premium tile patterns, and a 7-step type scale — all theme-aware across 3 cognitive modes',
      'Circadian-aware AI Day Planner: respects your chronotype, energy peaks/valleys, protected life-blocks, and task energy types — schedules draining work when you\'re sharp, light tasks when you\'re fading',
      'Passive behavioral sensing: infers cognitive state from interaction patterns without requiring explicit user input — drives automatic theme suggestions and burnout alerts',
      'Client-side encryption for sensitive data with separate server-side encryption layer — privacy-first architecture where sensitive keys never leave the device unencrypted',
    ],
    architecture: 'graph TB\n  subgraph Product\n    A[Web App] --> B[Database]\n    A --> C[AI Layer]\n    A --> D[Auth]\n    A --> E[Payments]\n    F[Mobile App] --> A\n    G[Desktop App] --> A\n  end\n  subgraph Intelligence\n    H[Burnout Detection] --> C\n    I[Day Planner] --> C\n    J[Cortex Assistant] --> C\n    K[Behavioral Sensing] --> H\n  end\n  subgraph Privacy\n    L[Client Encryption] --> A\n    M[P2P Sync Engine] --> F\n    M --> G\n  end',
    pipelineSteps: [
      { label: 'Cognitive Sensing', detail: 'Explicit energy check-ins combined with passive behavioral pattern analysis. A composite score drives theme suggestions with hysteresis buffering to prevent mode-switching flicker.' },
      { label: 'Adaptive UI', detail: 'Three themes swap the entire design surface — typography, shadow systems, animation curves, information density, and touch target sizes. Each mode is designed for a specific cognitive state.' },
      { label: 'Task Intelligence', detail: 'Natural language quick-add, recurring task engine, difficulty/energy zone system, AI decomposition into subtasks, and 5 task views (List, Day, Week, Calendar, Kanban) with drag-and-drop.' },
      { label: 'Burnout Prevention', detail: 'Multi-signal behavioral algorithm with personal baselines and false-positive suppression. Auto-triggers Rest mode with a recovery overlay when sustained low energy is detected.' },
      { label: 'AI Orchestration', detail: '12 AI features with schema-validated responses, per-user rate limiting, cost tracking, background processing, and a theme-adaptive AI personality that matches your current cognitive mode.' },
      { label: 'Cross-Platform Sync', detail: 'Cloud sync for primary data, local caching for offline access, and P2P encrypted device sync via WebRTC — three sync strategies ensuring your data is always available and always private.' },
    ],
    theme: {
      accent: '#FFB088',
      accentAlt: '#A0AEC0',
      variant: 'showcase',
    },
  },

  'statistical-analysis-of-customer-complaint-topics': {
    hook: 'Analyzing 164,003 CFPB customer complaint narratives to model complaint topics with LDA and quantify dispute rate disparities using R hypothesis testing.',
    problem: 'Financial institutions receive massive volumes of unstructured complaint text. Manual categorization is impossible at scale, and institutions need statistically rigorous evidence to identify which complaint topics lead to significantly higher consumer dispute rates.',
    approach: 'Built a two-phase NLP and statistical inference pipeline. Phase 1 (Python): preprocessed 164,003 CFPB complaints using NLTK (lowercasing, tokenization, stopword removal, lemmatization), vectorized TF-IDF features with Gensim, and trained a Latent Dirichlet Allocation (LDA) model to discover 7 latent topics. Phase 2 (R): evaluated dispute rates across topics using tidyverse and ggplot2, performed a two-proportion z-test (prop.test), and computed a 95% confidence interval.',
    results: [
      'Preprocessed and categorized 164,003 CFPB customer complaint narratives into 7 LDA topics',
      'Measured a statistically significant gap in consumer dispute rates: 24.1% vs 16.9% between highest and lowest friction topics',
      'Confirmed statistical significance via two-proportion z-test: p < 2.2e-16',
      'Calculated 95% confidence interval for the dispute rate difference: [6.5%, 7.8%]',
    ],
    learned: [
      'Unsupervised LDA topic modeling on large text corpora requires iterative vocabulary filtering and TF-IDF weighting for distinct topic separation',
      'Rigorous statistical hypothesis testing (two-proportion z-test with confidence intervals) turns NLP topic outputs into actionable business intelligence',
    ],
    summary: 'An end-to-end NLP and statistical analysis project extracting actionable business intelligence from 164,003 CFPB customer complaints. Combines Python LDA topic modeling across 7 latent topics with R hypothesis testing to prove a 24.1% vs 16.9% dispute rate disparity (p < 2.2e-16, 95% CI [6.5%, 7.8%]).',
    metrics: [
      { label: 'Complaints', value: '164,003', context: 'CFPB dataset' },
      { label: 'LDA Topics', value: '7', context: 'discovered' },
      { label: 'Dispute Rates', value: '24.1% vs 16.9%', context: 'high vs low' },
      { label: 'Significance', value: 'p < 2.2e-16', context: 'two-prop z-test' },
      { label: '95% CI', value: '[6.5%, 7.8%]', context: 'diff interval' },
    ],
    techHighlights: [
      'Python NLTK preprocessing pipeline: tokenization, stopword removal, lemmatization, and Bag-of-Words TF-IDF vectorization',
      'Gensim Latent Dirichlet Allocation (LDA) modeling discovering 7 clear complaint themes',
      'R statistical inference using prop.test for two-proportion z-testing and ggplot2 visual reporting',
    ],
    theme: {
      accent: '#3b82f6',
      accentAlt: '#1d4ed8',
      variant: 'research',
    },
  },

  'nlp-statistical-analysis-of-customer-complaints': {
    hook: 'Analyzing 164,003 CFPB customer complaint narratives to model complaint topics with LDA and quantify dispute rate disparities using R hypothesis testing.',
    problem: 'Financial institutions receive massive volumes of unstructured complaint text. Manual categorization is impossible at scale, and institutions need statistically rigorous evidence to identify which complaint topics lead to significantly higher consumer dispute rates.',
    approach: 'Built a two-phase NLP and statistical inference pipeline. Phase 1 (Python): preprocessed 164,003 CFPB complaints using NLTK, vectorized TF-IDF features with Gensim, and trained a Latent Dirichlet Allocation (LDA) model to discover 7 latent topics. Phase 2 (R): evaluated dispute rates across topics using tidyverse and ggplot2, performed a two-proportion z-test (prop.test), and computed a 95% confidence interval.',
    results: [
      'Preprocessed and categorized 164,003 CFPB customer complaint narratives into 7 LDA topics',
      'Measured a statistically significant gap in consumer dispute rates: 24.1% vs 16.9% between highest and lowest friction topics',
      'Confirmed statistical significance via two-proportion z-test: p < 2.2e-16',
      'Calculated 95% confidence interval for the dispute rate difference: [6.5%, 7.8%]',
    ],
    learned: [
      'Unsupervised LDA topic modeling on large text corpora requires iterative vocabulary filtering and TF-IDF weighting for distinct topic separation',
      'Rigorous statistical hypothesis testing (two-proportion z-test with confidence intervals) turns NLP topic outputs into actionable business intelligence',
    ],
    summary: 'An end-to-end NLP and statistical analysis project extracting actionable business intelligence from 164,003 CFPB customer complaints. Combines Python LDA topic modeling across 7 latent topics with R hypothesis testing to prove a 24.1% vs 16.9% dispute rate disparity (p < 2.2e-16, 95% CI [6.5%, 7.8%]).',
    metrics: [
      { label: 'Complaints', value: '164,003', context: 'CFPB dataset' },
      { label: 'LDA Topics', value: '7', context: 'discovered' },
      { label: 'Dispute Rates', value: '24.1% vs 16.9%', context: 'high vs low' },
      { label: 'Significance', value: 'p < 2.2e-16', context: 'two-prop z-test' },
      { label: '95% CI', value: '[6.5%, 7.8%]', context: 'diff interval' },
    ],
    techHighlights: [
      'Python NLTK preprocessing pipeline: tokenization, stopword removal, lemmatization, and Bag-of-Words TF-IDF vectorization',
      'Gensim Latent Dirichlet Allocation (LDA) modeling discovering 7 clear complaint themes',
      'R statistical inference using prop.test for two-proportion z-testing and ggplot2 visual reporting',
    ],
    theme: {
      accent: '#3b82f6',
      accentAlt: '#1d4ed8',
      variant: 'research',
    },
  },

  'revenue-and-operations-intelligence': {
    hook: 'Market basket analysis and operations intelligence pipeline evaluating 3.4M+ Instacart orders from 200K+ users across 50K+ products.',
    problem: 'Large e-commerce platforms handle millions of customer transactions across tens of thousands of items. Discovering purchase sequences, user reorder behavior, and product affinity patterns requires scalable data processing and feature engineering.',
    approach: 'Engineered a customer transaction and operations intelligence pipeline in Python and SQL to analyze 3.4M+ Instacart orders from 200K+ users. Structured product affinity matrices and reorder prediction features across 50K+ catalog products, serving recommendation and inventory models across 49K+ products.',
    results: [
      'Analyzed 3.4M+ Instacart orders across 200K+ users',
      'Engineered feature matrix across 50K+ catalog products',
      'Built market basket and recommendation pipelines serving 49K+ products',
    ],
    learned: [
      'Processing large transaction datasets efficiently requires optimizing pandas memory types and SQL window functions for user reorder history calculations',
    ],
    summary: 'An e-commerce operations intelligence and market basket analysis system evaluating 3.4M+ Instacart orders, 200K+ users, and 50K+ catalog products, with recommendation models serving 49K+ products.',
    metrics: [
      { label: 'Orders', value: '3.4M+', context: 'analyzed' },
      { label: 'Users', value: '200K+', context: 'consumers' },
      { label: 'Products', value: '50K+', context: 'catalog' },
      { label: 'Served', value: '49K+', context: 'products' },
    ],
    techHighlights: [
      'Python (pandas, numpy, scikit-learn) and SQL transaction pipelines',
      'User reorder probability and product association matrix algorithms',
      'E-commerce operations and inventory analytics dashboards',
    ],
    theme: {
      accent: '#10b981',
      accentAlt: '#047857',
      variant: 'dashboard',
    },
  },

  'instacart-market-basket-analysis': {
    hook: 'Market basket analysis and operations intelligence pipeline evaluating 3.4M+ Instacart orders from 200K+ users across 50K+ products.',
    problem: 'Large e-commerce platforms handle millions of customer transactions across tens of thousands of items. Discovering purchase sequences, user reorder behavior, and product affinity patterns requires scalable data processing and feature engineering.',
    approach: 'Engineered a customer transaction and operations intelligence pipeline in Python and SQL to analyze 3.4M+ Instacart orders from 200K+ users. Structured product affinity matrices and reorder prediction features across 50K+ catalog products, serving recommendation and inventory models across 49K+ products.',
    results: [
      'Analyzed 3.4M+ Instacart orders across 200K+ users',
      'Engineered feature matrix across 50K+ catalog products',
      'Built market basket and recommendation pipelines serving 49K+ products',
    ],
    learned: [
      'Processing large transaction datasets efficiently requires optimizing pandas memory types and SQL window functions for user reorder history calculations',
    ],
    summary: 'An e-commerce operations intelligence and market basket analysis system evaluating 3.4M+ Instacart orders, 200K+ users, and 50K+ catalog products, with recommendation models serving 49K+ products.',
    metrics: [
      { label: 'Orders', value: '3.4M+', context: 'analyzed' },
      { label: 'Users', value: '200K+', context: 'consumers' },
      { label: 'Products', value: '50K+', context: 'catalog' },
      { label: 'Served', value: '49K+', context: 'products' },
    ],
    techHighlights: [
      'Python (pandas, numpy, scikit-learn) and SQL transaction pipelines',
      'User reorder probability and product association matrix algorithms',
      'E-commerce operations and inventory analytics dashboards',
    ],
    theme: {
      accent: '#10b981',
      accentAlt: '#047857',
      variant: 'dashboard',
    },
  },
}



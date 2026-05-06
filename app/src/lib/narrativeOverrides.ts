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
    hook: 'Can a vision model smaller than GPT-2 reliably read a pressure gauge or detect pipe corrosion under field conditions — glare, oblique angles, low resolution — on a 6GB GPU?',
    problem: 'Industrial safety audits still rely on manual visual inspection of analog gauges and pipeline surfaces. Large Vision-Language Models (VLMs) can automate this, but production deployment on edge hardware requires models under 3 billion parameters with strict VRAM budgets (≤6GB). No existing benchmark evaluates sub-3B VLMs specifically on safety-critical industrial tasks with adversarial visual stressors.',
    approach: 'I designed a modular research pipeline comparing 5 sub-3B VLMs (SmolVLM-500M, InternVL2-1B, Janus-Pro-1B, Qwen2-VL-2B, MiniCPM-V-2.8B) across 5 prompting strategies: zero-shot baseline, Chain-of-Thought, Rule Decomposition, CLAHE contrast enhancement + Decomposition, and CLAHE + CoT. Each configuration was evaluated on a curated "Golden 100" benchmark of industrial images under adversarial conditions, with 3 deterministic runs per model and McNemar\'s exact paired test to prevent arbitrary benchmarking.',
    results: [
      'Evaluated 5 models × 5 strategies × 3 runs = 75 experimental configurations across 200 evaluation rows',
      'Built a curated "Golden 100" benchmark: 50 analog gauge images with visual stressors + 50 pipeline images (25 corroded, 25 non-corroded)',
      'Discovered that Rule Decomposition consistently outperforms Chain-of-Thought for logic compliance (LCR) in safety-critical decisions',
      'Identified critical failure modes: Attention Overshadowing in small models and Modality Collapse under CLAHE preprocessing',
      'Documented statistically significant results (p < 0.05 via McNemar) preventing false positive claims from single-run benchmarks',
      'Full pipeline reproducible in one command (run_all.ps1) — 7 phases, ~4-6 hours on a single T4/L4 GPU',
    ],
    learned: [
      'Single-run benchmarks are dangerous for safety-critical applications — multi-run validation with paired statistical tests is essential to prevent publishing noise as signal',
      'CLAHE contrast enhancement helps human perception but can actually degrade VLM performance through Modality Collapse, where the model fixates on enhanced texture patterns instead of semantic content',
      'Smaller models (<1B) exhibit Attention Overshadowing — they allocate disproportionate attention to salient visual features while ignoring textual rule constraints, making them unreliable for SOP compliance',
    ],
    summary: 'A research-grade benchmarking pipeline evaluating five sub-3B parameter Vision-Language Models on industrial safety auditing under strict hardware constraints (6GB VRAM). Features a curated 100-image benchmark with adversarial conditions, five prompting strategies, deterministic multi-run validation, and McNemar statistical testing to produce deployment-ready model selection guidance.',
    metrics: [
      { label: 'Models', value: '6', context: 'sub-3B VLMs' },
      { label: 'Strategies', value: '5', context: 'prompting' },
      { label: 'Runs', value: '75', context: 'configs' },
      { label: 'Images', value: '100', context: 'Golden set' },
      { label: 'McNemar Tests', value: '7', context: 'significance CSVs' },
      { label: 'Paper', value: 'NeurIPS', context: 'format' },
    ],

    screenshots: [
      { url: '/projects/vlm/baseline_danger_bar.png', caption: 'Baseline Danger Classification — Zero-shot accuracy across all 6 models on the safety-critical binary task' },
      { url: '/projects/vlm/modality_collapse_slope.png', caption: 'Modality Collapse — CLAHE preprocessing degrades VLM performance by shifting attention to texture artifacts' },
      { url: '/projects/vlm/hardware_bubble_vram.png', caption: 'Hardware Profiling — VRAM usage vs inference latency bubble chart across all model architectures' },
      { url: '/projects/vlm/foveation_vs_baseline.png', caption: 'Foveation Enhancement vs Baseline — Measuring impact of attention-guided cropping on gauge reading accuracy' },
      { url: '/projects/vlm/foveation_demo.png', caption: 'Foveation Pipeline Demo — Center-crop attention preprocessing applied to industrial gauge images' },
      { url: '/projects/vlm/gauge_sample.jpg', caption: 'Golden 100 Dataset — Analog pressure gauge with visual stressors (glare, partial obstruction)' },
      { url: '/projects/vlm/pipe_corroded_sample.jpg', caption: 'Golden 100 Dataset — Corroded industrial pipe requiring binary defect classification' },
      { url: '/projects/vlm/pipe_clean_sample.jpg', caption: 'Golden 100 Dataset — Non-corroded pipe baseline (texture overlap challenge with corroded samples)' },
    ],

    callouts: [
      {
        title: 'Best Model',
        value: 'MiniCPM-V (0.699 F1 w/ CLAHE+Decomp)',
        description: 'Highest F1 and lowest FNR (0.163) under the best prompting strategy. Only model to maintain consistent performance across all 5 strategies with FNR below 0.40.',
        type: 'success',
      },
      {
        title: 'Decomposition > CoT',
        value: 'p = 0.0000 (Qwen2-VL)',
        description: 'Rule Decomposition statistically outperforms Chain-of-Thought for logic compliance in 4 of 6 models (McNemar p < 0.05). CoT causes Attention Overshadowing in smaller architectures.',
        type: 'info',
      },
      {
        title: 'Modality Collapse',
        value: 'CLAHE degrades SmolVLM to 0.000 F1',
        description: 'Contrast-adaptive preprocessing causes catastrophic failure in sub-1B models — SmolVLM drops from 0.444 baseline F1 to 0.000 under CLAHE+CoT. The model fixates on enhanced texture patterns.',
        type: 'critical',
      },
      {
        title: 'Safety-Critical Gap',
        value: 'Best FNR still 16.3%',
        description: 'Even the top-performing configuration misses 1 in 6 real defects. No sub-3B model achieves FNR below 10% — confirming these models require human-in-the-loop deployment for safety-critical auditing.',
        type: 'warning',
      },
    ],

    charts: [
      {
        type: 'horizontal-bar' as const,
        title: 'Best F1 Score by Model (Best Strategy)',
        data: [
          { label: 'MiniCPM-V', value: 0.699, color: '#22c55e' },
          { label: 'InternVL2', value: 0.687, color: '#3b82f6' },
          { label: 'Qwen2-VL', value: 0.621, color: '#8b5cf6' },
          { label: 'SmolVLM', value: 0.444, color: '#f59e0b' },
          { label: 'Janus-Pro', value: 0.299, color: '#ef4444' },
          { label: 'Gemma 4', value: 0.117, color: '#6b7280' },
        ],
        valueFormat: 'number' as const,
        xLabel: 'F1 Score',
        insight: 'MiniCPM-V with CLAHE+Decomposition achieves the highest F1 (0.699) — the only model to exceed 0.65 on the safety-critical benchmark.',
      },
      {
        type: 'horizontal-bar' as const,
        title: 'False Negative Rate — Lower is Safer',
        data: [
          { label: 'MiniCPM-V', value: 0.163, color: '#22c55e' },
          { label: 'InternVL2', value: 0.181, color: '#3b82f6' },
          { label: 'Qwen2-VL', value: 0.267, color: '#8b5cf6' },
          { label: 'SmolVLM', value: 0.588, color: '#f59e0b' },
          { label: 'Janus-Pro', value: 0.807, color: '#ef4444' },
          { label: 'Gemma 4', value: 0.933, color: '#6b7280' },
        ],
        valueFormat: 'number' as const,
        xLabel: 'FNR (↓ better)',
        insight: 'FNR is the critical metric for industrial safety — a missed defect (false negative) can cause catastrophic failure. Even MiniCPM-V misses 16.3% of real defects.',
      },
    ],

    techHighlights: [
      'PyTorch + HuggingFace Transformers with 4-bit NF4 quantization (Bitsandbytes) for models exceeding 2B parameters',
      'Custom CLAHE preprocessing pipeline for contrast-adaptive enhancement of industrial images',
      'Deterministic multi-run framework (N=3) with McNemar\'s exact paired test for statistical significance validation',
      'ANLS (reading accuracy) + LCR (logic compliance) + F1 + Accuracy metrics designed for safety-critical evaluation',
      'Automated failure analysis pipeline mapping neural architecture patterns to safety-critical tradeoffs (FPR vs FNR)',
    ],
    architecture: '/projects/vlm/hardware_bubble_vram.png',
    pipelineSteps: [
      { label: 'Dataset Curation', detail: 'Built the "Golden 100": 50 analog gauges with visual stressors (glare, oblique angles, obstructions) + 50 pipeline images (corroded vs non-corroded) with texture overlap challenges. 200 evaluation rows testing opposing SOP rules.' },
      { label: 'Model Setup', detail: 'Configured 6 sub-3B VLMs with precision-aware loading: bfloat16 for models under 1.5B, 4-bit NF4 quantization for larger models. Dual virtual environments for dependency isolation.' },
      { label: 'Inference Pipeline', detail: 'Ran 5 prompting strategies (Baseline, CoT, Decomposition, CLAHE+Decomp, CLAHE+CoT) across all models with greedy decoding and repetition penalty 1.1.' },
      { label: 'Multi-Run Validation', detail: 'Repeated each configuration 3 times with deterministic seeds. Aggregated metrics across runs to capture variance and prevent arbitrary benchmarking.' },
      { label: 'Statistical Testing', detail: 'Applied McNemar\'s exact paired test to identify statistically significant differences (p < 0.05) between model pairs, preventing false claims from random fluctuations.' },
      { label: 'Failure Analysis', detail: 'Mapped failure patterns to neural architecture hypotheses: Attention Overshadowing, Modality Collapse, and safety-critical FPR/FNR tradeoffs documented in formal proofs.' },
    ],
    theme: {
      accent: '#d4a574',
      accentAlt: '#b8860b',
      variant: 'research',
    },
  },
}

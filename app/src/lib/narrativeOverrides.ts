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
}

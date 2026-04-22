// PM2 process manager config — runs all backends + serves built frontends
module.exports = {
  apps: [
    // ── GAINS Backend (Node/Express) ─────────────────────────────
    {
      name: 'gains-backend',
      cwd: './GAINS',
      script: 'server/index.js',
      env: { NODE_ENV: 'production', PORT: 3003 },
    },

    // ── Petrol IoT Backend (Python/uvicorn) ──────────────────────
    {
      name: 'petrol-backend',
      cwd: './backend',
      script: 'start_petrol.sh',
      interpreter: 'bash',
    },

    // ── Causal Backend (Python/uvicorn) ──────────────────────────
    {
      name: 'causal-backend',
      cwd: './Causal/backend',
      script: 'start_causal.sh',
      interpreter: 'bash',
    },
  ],
}

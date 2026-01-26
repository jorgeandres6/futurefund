// API Server for n8n Integration
// This server exposes endpoints that n8n can call to execute searches

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Import Supabase client
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /api/jobs/create
// Create a new search job
app.post('/api/jobs/create', async (req, res) => {
  try {
    const { userId, autoAnalyze = false, webhookUrl } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Load user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Create job
    const { data: job, error } = await supabase
      .from('search_jobs')
      .insert({
        user_id: userId,
        status: 'pending',
        auto_analyze: autoAnalyze,
        profile_snapshot: profile || null,
        webhook_url: webhookUrl || null
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, job });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/jobs/execute
// Execute a search job (called by n8n)
app.post('/api/jobs/execute', async (req, res) => {
  try {
    const { jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('search_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Start execution asynchronously
    // Return immediately to n8n
    res.json({ 
      success: true, 
      message: 'Job execution started',
      jobId: job.id 
    });

    // Execute job in background
    executeSearchJob(job).catch(err => {
      console.error('Job execution error:', err);
    });

  } catch (error) {
    console.error('Error executing job:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/jobs/:jobId
// Get job status
app.get('/api/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const { data: job, error } = await supabase
      .from('search_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ job });
  } catch (error) {
    console.error('Error getting job:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/users/premium
// Get all premium users (for n8n to query)
app.get('/api/users/premium', async (req, res) => {
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('user_id, company_name, user_type')
      .eq('user_type', 'premium');

    if (error) throw error;

    res.json({ users: profiles || [] });
  } catch (error) {
    console.error('Error getting premium users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Main job execution function
async function executeSearchJob(job) {
  const jobId = job.id;
  const userId = job.user_id;
  const profile = job.profile_snapshot;

  try {
    // Update to running
    await updateJob(jobId, {
      status: 'running',
      started_at: new Date().toISOString(),
      progress: 0,
      current_phase: 'Inicializando...'
    });

    // Import search functions
    const { 
      performGlobalSearch, 
      performEcuadorSearch 
    } = require('./searchEngine');

    let allFunds = [];

    // Phase 1: Global Discovery (25%)
    await updateJob(jobId, {
      progress: 10,
      current_phase: 'Fase 1/4: Descubrimiento global'
    });

    const globalResults = await performGlobalSearch(profile);
    allFunds = [...allFunds, ...globalResults];
    await saveFunds(userId, allFunds);
    await updateJob(jobId, { funds_found: allFunds.length, progress: 25 });

    // Phase 2: Ecuador Discovery (50%)
    await updateJob(jobId, {
      progress: 40,
      current_phase: 'Fase 2/4: Descubrimiento Ecuador'
    });

    const ecuadorResults = await performEcuadorSearch(profile);
    allFunds = [...allFunds, ...ecuadorResults];
    await saveFunds(userId, allFunds);
    await updateJob(jobId, { funds_found: allFunds.length, progress: 50 });

    // Phase 3: Auto-analysis (if enabled)
    if (job.auto_analyze) {
      await updateJob(jobId, {
        progress: 60,
        current_phase: 'Analizando fondos...'
      });

      const { analyzeFund } = require('./analyzer');
      let analyzed = 0;
      
      for (const fund of allFunds) {
        if (!fund.analisis_aplicacion) {
          try {
            const analysis = await analyzeFund(fund);
            if (analysis) {
              await supabase
                .from('funds')
                .update({
                  es_elegible: analysis.es_elegible,
                  resumen_requisitos: analysis.resumen_requisitos,
                  pasos_aplicacion: analysis.pasos_aplicacion,
                  fechas_clave: analysis.fechas_clave,
                  link_directo_aplicacion: analysis.link_directo_aplicacion,
                  contact_emails: analysis.contact_emails
                })
                .eq('user_id', userId)
                .eq('nombre_fondo', fund.nombre_fondo);

              analyzed++;
              await updateJob(jobId, { 
                funds_analyzed: analyzed,
                progress: 60 + Math.floor((analyzed / allFunds.length) * 30)
              });
            }
          } catch (err) {
            console.error(`Error analyzing ${fund.nombre_fondo}:`, err);
          }
        }
      }
    }

    // Complete
    await updateJob(jobId, {
      status: 'completed',
      progress: 100,
      current_phase: 'Completado',
      completed_at: new Date().toISOString(),
      result_summary: {
        total_funds: allFunds.length,
        phases_completed: job.auto_analyze ? 3 : 2,
        analyzed_funds: job.auto_analyze ? allFunds.filter(f => f.analisis_aplicacion).length : 0
      }
    });

    // Send webhook notification if configured
    if (job.webhook_url) {
      await fetch(job.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          jobId, 
          status: 'completed',
          funds_found: allFunds.length 
        })
      }).catch(err => console.error('Webhook failed:', err));
    }

  } catch (error) {
    console.error('Job execution error:', error);
    
    await updateJob(jobId, {
      status: 'failed',
      error_message: error.message,
      completed_at: new Date().toISOString()
    });
  }
}

// Helper: Update job
async function updateJob(jobId, updates) {
  await supabase
    .from('search_jobs')
    .update(updates)
    .eq('id', jobId);
}

// Helper: Save funds to database
async function saveFunds(userId, funds) {
  if (funds.length === 0) return;

  const fundsData = funds.map(fund => ({
    user_id: userId,
    nombre_fondo: fund.nombre_fondo,
    gestor_activos: fund.gestor_activos,
    ticker_isin: fund.ticker_isin,
    url_fuente: fund.url_fuente,
    fecha_scrapeo: fund.fecha_scrapeo,
    ods_encontrados: fund.alineacion_detectada.ods_encontrados,
    keywords_encontradas: fund.alineacion_detectada.keywords_encontradas,
    puntuacion_impacto: fund.alineacion_detectada.puntuacion_impacto,
    evidencia_texto: fund.evidencia_texto,
    es_elegible: fund.analisis_aplicacion?.es_elegible || null,
    resumen_requisitos: fund.analisis_aplicacion?.resumen_requisitos || null,
    pasos_aplicacion: fund.analisis_aplicacion?.pasos_aplicacion || null,
    fechas_clave: fund.analisis_aplicacion?.fechas_clave || null,
    link_directo_aplicacion: fund.analisis_aplicacion?.link_directo_aplicacion || null,
    contact_emails: fund.analisis_aplicacion?.contact_emails || null,
    ...(fund.applicationStatus ? { application_status: fund.applicationStatus } : {})
  }));

  await supabase
    .from('funds')
    .upsert(fundsData, {
      onConflict: 'user_id,nombre_fondo',
      ignoreDuplicates: false
    });
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 FutureFund API Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;

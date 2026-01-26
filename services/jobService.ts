// API Endpoints for n8n Integration
// These functions can be called via Supabase Edge Functions or a separate API server

import { supabase } from './supabaseClient';
import { Fund, CompanyProfile } from '../types';
import { 
  discoverFinancingSources, 
  expandSearch, 
  discoverEcuadorFinancingSources, 
  expandEcuadorSearch 
} from './geminiService';

export interface SearchJob {
  id: string;
  user_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  current_phase: string | null;
  error_message: string | null;
  funds_found: number;
  funds_analyzed: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  profile_snapshot: CompanyProfile | null;
  result_summary: any;
  webhook_url: string | null;
}

/**
 * Create a new search job
 * This is called by n8n to start a background search
 */
export const createSearchJob = async (
  userId: string,
  webhookUrl?: string
): Promise<SearchJob> => {
  try {
    // Load user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    const { data, error } = await (supabase as any)
      .from('search_jobs')
      .insert({
        user_id: userId,
        status: 'pending',
        profile_snapshot: profile || null,
        webhook_url: webhookUrl || null
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating search job:', error);
    throw error;
  }
};

/**
 * Update search job status and progress
 */
export const updateSearchJob = async (
  jobId: string,
  updates: Partial<SearchJob>
): Promise<void> => {
  try {
    const { error } = await (supabase as any)
      .from('search_jobs')
      .update(updates)
      .eq('id', jobId);

    if (error) throw error;

    // If webhook URL exists, send update
    if (updates.webhook_url) {
      await fetch(updates.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, updates })
      }).catch(err => console.error('Webhook notification failed:', err));
    }
  } catch (error) {
    console.error('Error updating search job:', error);
    throw error;
  }
};

/**
 * Get search job by ID
 */
export const getSearchJob = async (jobId: string): Promise<SearchJob | null> => {
  try {
    const { data, error } = await (supabase as any)
      .from('search_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting search job:', error);
    return null;
  }
};

/**
 * Get all jobs for a user
 */
export const getUserSearchJobs = async (userId: string): Promise<SearchJob[]> => {
  try {
    const { data, error } = await (supabase as any)
      .from('search_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting user jobs:', error);
    return [];
  }
};

/**
 * Execute a search job (to be called by n8n workflow)
 * This runs the entire search process in the background
 */
export const executeSearchJob = async (jobId: string): Promise<void> => {
  let job: SearchJob | null = null;
  
  try {
    // Get job details
    job = await getSearchJob(jobId);
    if (!job) throw new Error('Job not found');

    // Update to running
    await updateSearchJob(jobId, {
      status: 'running',
      started_at: new Date().toISOString(),
      progress: 0,
      current_phase: 'Inicializando...'
    });

    const userId = job.user_id;
    const profile = job.profile_snapshot as CompanyProfile | undefined;
    let allFunds: Fund[] = [];

    // Phase 1: Global Discovery
    await updateSearchJob(jobId, {
      progress: 10,
      current_phase: 'Fase 1/4: Descubrimiento global'
    });
    
    const globalInitial = await discoverFinancingSources(undefined, profile);
    allFunds = [...allFunds, ...globalInitial];
    
    // Save intermediate results
    await saveFundsToDatabase(userId, allFunds);
    await updateSearchJob(jobId, { funds_found: allFunds.length });

    // Phase 2: Global Expansion
    await updateSearchJob(jobId, {
      progress: 30,
      current_phase: 'Fase 2/4: Expansión global'
    });
    
    const globalExpanded = await expandSearch(globalInitial, undefined, profile);
    allFunds = [...allFunds, ...globalExpanded];
    
    await saveFundsToDatabase(userId, allFunds);
    await updateSearchJob(jobId, { funds_found: allFunds.length });

    // Phase 3: Ecuador Discovery
    await updateSearchJob(jobId, {
      progress: 50,
      current_phase: 'Fase 3/4: Descubrimiento Ecuador'
    });
    
    const ecuadorInitial = await discoverEcuadorFinancingSources(undefined, profile);
    allFunds = [...allFunds, ...ecuadorInitial];
    
    await saveFundsToDatabase(userId, allFunds);
    await updateSearchJob(jobId, { funds_found: allFunds.length });

    // Phase 4: Ecuador Expansion
    await updateSearchJob(jobId, {
      progress: 70,
      current_phase: 'Fase 4/4: Expansión Ecuador'
    });
    
    const ecuadorExpanded = await expandEcuadorSearch(ecuadorInitial, undefined, profile);
    allFunds = [...allFunds, ...ecuadorExpanded];
    
    await saveFundsToDatabase(userId, allFunds);
    await updateSearchJob(jobId, { funds_found: allFunds.length });

    // Complete - Sin análisis automático (N8N lo hará)
    await updateSearchJob(jobId, {
      status: 'completed',
      progress: 100,
      current_phase: 'Completado',
      completed_at: new Date().toISOString(),
      result_summary: {
        total_funds: allFunds.length,
        phases_completed: 4,
        note: 'Fondos insertados sin análisis. N8N los analizará automáticamente.'
      }
    });

  } catch (error: any) {
    console.error('Error executing search job:', error);
    
    if (job) {
      await updateSearchJob(jobId, {
        status: 'failed',
        error_message: error.message || 'Unknown error',
        completed_at: new Date().toISOString()
      });
    }
    
    throw error;
  }
};

/**
 * Helper to save funds to database
 */
async function saveFundsToDatabase(userId: string, funds: Fund[]): Promise<void> {
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

  await (supabase as any)
    .from('funds')
    .upsert(fundsData, {
      onConflict: 'user_id,nombre_fondo',
      ignoreDuplicates: false
    });
}

/**
 * Cancel a running job
 */
export const cancelSearchJob = async (jobId: string): Promise<void> => {
  try {
    await updateSearchJob(jobId, {
      status: 'cancelled',
      completed_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error cancelling job:', error);
    throw error;
  }
};

import { supabase } from './supabaseClient';
import { CompanyProfile, Fund } from '../types';
import { Database } from '../types/database';

type ProfilesTable = Database['public']['Tables']['profiles'];
type FundsTable = Database['public']['Tables']['funds'];

type ProfileRow = ProfilesTable['Row'];
type ProfileInsert = ProfilesTable['Insert'];
type ProfileUpdate = ProfilesTable['Update'];

type FundRow = FundsTable['Row'];
type FundInsert = FundsTable['Insert'];
type FundUpdate = FundsTable['Update'];

/**
 * Save or update user profile in Supabase
 */
export const saveProfile = async (userId: string, profile: CompanyProfile) => {
  try {
    const profileData: ProfileInsert = {
      user_id: userId,
      company_name: profile.companyName,
      address: profile.address,
      company_type: profile.companyType,
      status: profile.status,
      financing_type: profile.financingType,
      incorporation_date: profile.incorporationDate,
      amount_required: profile.amountRequired,
      has_brief: profile.hasBrief,
      has_financials: profile.hasFinancials,
      selected_ods: profile.selectedOds,
      brief_file_name: profile.briefFileName,
      financials_file_name: profile.financialsFileName,
      brief_file_base64: profile.briefFileBase64,
      brief_mime_type: profile.briefMimeType,
      financials_file_base64: profile.financialsFileBase64,
      financials_mime_type: profile.financialsMimeType,
      financial_metrics: (profile.financialMetrics as any) ?? null,
      ai_generated_summary: profile.aiGeneratedSummary,
      user_type: profile.userType || 'demo', // Default to 'demo' for new users
    };

    const { data, error } = await supabase
      .from<'profiles', ProfilesTable>('profiles')
      .upsert(profileData, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving profile:', error);
    throw error;
  }
};

/**
 * Load user profile from Supabase
 */
export const loadProfile = async (userId: string): Promise<CompanyProfile | null> => {
  try {
    const { data, error } = await supabase
      .from<'profiles', ProfilesTable>('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No profile found
        return null;
      }
      throw error;
    }

    if (!data) return null;

    const profileData = data as ProfileRow;

    // Convert database format to CompanyProfile
    const profile: CompanyProfile = {
      companyName: profileData.company_name || '',
      address: profileData.address || '',
      companyType: profileData.company_type || '',
      status: profileData.status || '',
      financingType: profileData.financing_type || [],
      incorporationDate: profileData.incorporation_date || '',
      amountRequired: profileData.amount_required || '',
      hasBrief: profileData.has_brief || false,
      hasFinancials: profileData.has_financials || false,
      selectedOds: profileData.selected_ods || [],
      briefFileName: profileData.brief_file_name || undefined,
      financialsFileName: profileData.financials_file_name || undefined,
      briefFileBase64: profileData.brief_file_base64 || undefined,
      briefMimeType: profileData.brief_mime_type || undefined,
      financialsFileBase64: profileData.financials_file_base64 || undefined,
      financialsMimeType: profileData.financials_mime_type || undefined,
      financialMetrics: profileData.financial_metrics ? {
        van: (profileData.financial_metrics as any).van || '',
        tir: (profileData.financial_metrics as any).tir || '',
        ebitda: (profileData.financial_metrics as any).ebitda || '',
      } : undefined,
      aiGeneratedSummary: profileData.ai_generated_summary || undefined,
      userType: (profileData.user_type as 'demo' | 'basic' | 'premium') || 'demo',
    };

    return profile;
  } catch (error) {
    console.error('Error loading profile:', error);
    throw error;
  }
};

/**
 * Save funds to Supabase
 */
export const saveFunds = async (userId: string, funds: Fund[]) => {
  try {
    if (funds.length === 0) return [];

    // Use UPSERT to preserve external changes to application_status
    // We only update fields that the application manages
    const fundsData: FundInsert[] = funds.map(fund => ({
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
      // Update analyzed_at when fund has analysis or if explicitly provided
      ...(fund.analyzed_at ? { analyzed_at: fund.analyzed_at } : 
          fund.analisis_aplicacion ? { analyzed_at: new Date().toISOString() } : {}),
      // Only set application_status if explicitly provided by the app (not null/undefined)
      // This preserves external changes to the field
      ...(fund.applicationStatus ? { application_status: fund.applicationStatus } : {}),
    }));

    // UPSERT: insert new records or update existing ones based on user_id + nombre_fondo
    // onConflict specifies which columns form the unique constraint
    const { data, error } = await supabase
      .from<'funds', FundsTable>('funds')
      .upsert(fundsData, {
        onConflict: 'user_id,nombre_fondo',
        ignoreDuplicates: false, // We want to update, not ignore
      })
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving funds:', error);
    throw error;
  }
};

/**
 * Load funds from Supabase
 */
export const loadFunds = async (userId: string): Promise<Fund[]> => {
  try {
    const { data, error } = await supabase
      .from<'funds', FundsTable>('funds')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data) return [];

    // Convert database format to Fund
    const funds: Fund[] = data.map((item: FundRow) => ({
      nombre_fondo: item.nombre_fondo,
      gestor_activos: item.gestor_activos,
      ticker_isin: item.ticker_isin,
      url_fuente: item.url_fuente,
      fecha_scrapeo: item.fecha_scrapeo,
      alineacion_detectada: {
        ods_encontrados: item.ods_encontrados,
        keywords_encontradas: item.keywords_encontradas,
        puntuacion_impacto: item.puntuacion_impacto,
      },
      evidencia_texto: item.evidencia_texto,
        analisis_aplicacion: item.es_elegible ? {
          es_elegible: item.es_elegible,
          resumen_requisitos: item.resumen_requisitos || [],
          pasos_aplicacion: item.pasos_aplicacion || [],
          fechas_clave: item.fechas_clave || '',
          link_directo_aplicacion: item.link_directo_aplicacion || '',
          contact_emails: item.contact_emails || [],
        } : undefined,
      // Preserve the actual value from DB, including null (don't default to PENDIENTE)
      // This allows external applications to manage this field
      applicationStatus: item.application_status || undefined,
      updated_at: item.updated_at,
      analyzed_at: item.analyzed_at || undefined,
      history: item.history as any || undefined,
      created_at: item.created_at,
    }));

    return funds;
  } catch (error) {
    console.error('Error loading funds:', error);
    throw error;
  }
};

/**
 * Update a single fund's application status
 */
export const updateFundStatus = async (userId: string, fundName: string, status: string) => {
  try {
    const { error } = await supabase
      .from<'funds', FundsTable>('funds')
      .update({ application_status: status })
      .eq('user_id', userId)
      .eq('nombre_fondo', fundName);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating fund status:', error);
    throw error;
  }
};

/**
 * Save or update fund analysis in Supabase
 */
export const saveFundAnalysis = async (
  userId: string,
  fundName: string,
  analysis: {
    es_elegible: string;
    resumen_requisitos: string[];
    pasos_aplicacion: string[];
    fechas_clave: string;
    link_directo_aplicacion: string;
    contact_emails: string[];
  }
) => {
  try {
    const { error } = await supabase
      .from<'funds', FundsTable>('funds')
      .update({
        es_elegible: analysis.es_elegible,
        resumen_requisitos: analysis.resumen_requisitos,
        pasos_aplicacion: analysis.pasos_aplicacion,
        fechas_clave: analysis.fechas_clave,
        link_directo_aplicacion: analysis.link_directo_aplicacion,
        contact_emails: analysis.contact_emails,
        analyzed_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('nombre_fondo', fundName);

    if (error) throw error;
  } catch (error) {
    console.error('Error saving fund analysis:', error);
    throw error;
  }
};

/**
 * Get emails related to a specific fund
 */
export const getFundEmails = async (userId: string, fundName: string) => {
  try {
    // First, get the fund_id from the funds table
    const { data: fundData, error: fundError } = await supabase
      .from<'funds', FundsTable>('funds')
      .select('id')
      .eq('user_id', userId)
      .eq('nombre_fondo', fundName)
      .single();

    if (fundError || !fundData) {
      // No fund found or error, return empty array
      return [];
    }

    // Then get the emails for this fund
    const { data: emailData, error: emailError } = await supabase
      .from('email_tracking')
      .select('*')
      .eq('fund_id', fundData.id)
      .order('date', { ascending: false });

    if (emailError) throw emailError;

    return emailData || [];
  } catch (error) {
    console.error('Error getting fund emails:', error);
    return [];
  }
};

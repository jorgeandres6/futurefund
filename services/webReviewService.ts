import { GoogleGenAI, Type } from "@google/genai";
import { ApplicationAnalysis } from '../types';
import { getDemoData } from './geminiService';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    es_elegible: { 
      type: Type.STRING, 
      description: 'Breve evaluación de si una organización de Ecuador/Latam suele ser elegible (ej: "Sí, acepta internacionales", "No, solo USA", "Requiere Fiscal Sponsor").' 
    },
    resumen_requisitos: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Lista de requisitos clave (ej: "Status 501(c)(3)", "Auditoría financiera", "Reporte de impacto").',
    },
    pasos_aplicacion: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Pasos secuenciales detectados en la estructura web (ej: "1. Crear cuenta en portal", "2. Enviar carta de interés (LOI)", "3. Propuesta completa").',
    },
    fechas_clave: { 
      type: Type.STRING, 
      description: 'Información sobre deadlines, ciclos de financiamiento o si es "Rolling basis".' 
    },
    link_directo_aplicacion: { 
      type: Type.STRING, 
      description: 'La URL específica encontrada para iniciar el trámite o ver las guías (no la home page).' 
    },
    contact_emails: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Correos de contacto (ej: grants@..., info@..., soporte@...) EXTRAÍDOS LITERALMENTE de la página web. No inventar correos. Si no hay, dejar array vacío.',
    },
  },
  required: ['es_elegible', 'resumen_requisitos', 'pasos_aplicacion', 'fechas_clave', 'link_directo_aplicacion', 'contact_emails'],
};

/**
 * Analiza múltiples fondos en lote de forma automática (para usuarios premium)
 * Procesa los fondos sin análisis previo y los almacena en la base de datos
 */
export const autoAnalyzeFundsForPremium = async (
  funds: Array<{ nombre_fondo: string; url_fuente: string; analisis_aplicacion?: ApplicationAnalysis }>,
  onProgress?: (current: number, total: number, fundName: string) => void,
  signal?: AbortSignal
): Promise<Map<string, ApplicationAnalysis>> => {
  const results = new Map<string, ApplicationAnalysis>();
  
  // Filtrar solo fondos que no tienen análisis previo
  const fundsToAnalyze = funds.filter(f => !f.analisis_aplicacion);
  
  if (fundsToAnalyze.length === 0) {
    return results;
  }

  for (let i = 0; i < fundsToAnalyze.length; i++) {
    // Verificar si la operación fue cancelada
    if (signal?.aborted) {
      break;
    }

    const fund = fundsToAnalyze[i];
    
    try {
      onProgress?.(i + 1, fundsToAnalyze.length, fund.nombre_fondo);
      
      const analysis = await analyzeFundApplication(fund.nombre_fondo, fund.url_fuente);
      
      if (analysis) {
        results.set(fund.nombre_fondo, analysis);
      }
      
      // Pequeña pausa entre análisis para no saturar la API
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error analyzing ${fund.nombre_fondo}:`, error);
      // Continuar con el siguiente fondo
    }
  }

  return results;
};

/**
 * Analiza la estructura web del fondo para determinar cómo aplicar.
 * Utiliza Google Search Grounding para navegar conceptualmente y encontrar páginas de "Guidelines" o "Apply".
 */
export const analyzeFundApplication = async (fundName: string, fundUrl: string): Promise<ApplicationAnalysis | null> => {
  const prompt = `
    Actúa como un consultor experto en fundraising (Grant Writer).
    Tu tarea es investigar el proceso de aplicación para el fondo/organización: "${fundName}".
    Sitio web principal conocido: ${fundUrl}

    Usa Google Search para encontrar las páginas específicas de "Guidelines", "How to Apply", "Grantseekers", "Contact" o "Team" asociadas a esta organización.
    
    Analiza la estructura de la información y extrae:
    1. Si aceptan aplicaciones internacionales (específicamente Latinoamérica/Ecuador).
    2. Los requisitos técnicos principales.
    3. Los pasos exactos para aplicar (analiza la navegación del sitio: ¿hay portal? ¿es por email?).
    4. Fechas límite o ciclos actuales.
    5. El enlace más directo a la guía o formulario.
    6. Correos electrónicos de contacto (emails) REALES que aparezcan en el sitio (ej. staff de programas, info general). **IMPORTANTE: Solo extrae correos que veas en el texto, no inventes.**

    Si no encuentras información explícita, infiere basándote en la naturaleza de la organización (ej. si es un DAF privado, suele ser por invitación).
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // Using Pro model for better reasoning on complex tasks
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }], // Essential for finding the specific "Apply" pages
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
      },
    });

    const jsonText = response.text?.trim();
    if (!jsonText) return null;

    const result = JSON.parse(jsonText) as ApplicationAnalysis;

    // Lógica Demo: Sobrescribir el correo de contacto para los fondos de la demo
    const demoFunds = getDemoData().map(f => f.nombre_fondo);
    if (demoFunds.includes(fundName)) {
      result.contact_emails = ['jorgeandres6@msn.com'];
    }

    return result;

  } catch (error) {
    console.error("Error analyzing application process:", error);
    return null;
  }
};
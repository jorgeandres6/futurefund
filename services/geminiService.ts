
import { GoogleGenAI, Type } from "@google/genai";
import { Fund, CompanyProfile, FinancialMetrics } from '../types';

// Se inicializa el cliente de la API directamente con la variable de entorno.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Variables de entorno para Custom Search
const API_KEY = process.env.API_KEY;
const SEARCH_ENGINE_ID = process.env.SEARCH_ENGINE_ID;

const fundSchema = {
  type: Type.OBJECT,
  properties: {
    nombre_fondo: { type: Type.STRING, description: 'El nombre del Donor-Advised Fund (DAF), Fundación, Fondo de Inversión o entidad financiadora.' },
    gestor_activos: { type: Type.STRING, description: 'La organización patrocinadora (Sponsoring Organization), gestora de VC, o banco de desarrollo.' },
    ticker_isin: { type: Type.STRING, description: 'Si aplica, símbolo. Si es privado, usar "Privado" o "N/A".' },
    url_fuente: { type: Type.STRING, description: 'La URL de la organización o del fondo específico.' },
    fecha_scrapeo: { type: Type.STRING, description: 'La fecha actual en formato ISO 8601.' },
    alineacion_detectada: {
      type: Type.OBJECT,
      properties: {
        ods_encontrados: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Lista de ODS específicos mencionados en el contexto (ej., "ODS 12", "ODS 13").',
        },
        keywords_encontradas: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Lista de palabras clave encontradas (ej., "Filantropía", "Venture Capital", "Impact Investing").',
        },
        puntuacion_impacto: {
          type: Type.STRING,
          description: 'Descripción de la estrategia de inversión/donación basada en el texto encontrado.'
        },
      },
      required: ['ods_encontrados', 'keywords_encontradas', 'puntuacion_impacto'],
    },
    evidencia_texto: {
      type: Type.STRING,
      description: 'Fragmento del resultado de búsqueda que justifica la inclusión de este fondo.'
    },
  },
  required: ['nombre_fondo', 'gestor_activos', 'ticker_isin', 'url_fuente', 'fecha_scrapeo', 'alineacion_detectada', 'evidencia_texto'],
};

const fullResponseSchema = {
    type: Type.ARRAY,
    items: fundSchema,
};

// Schema for Brief Extraction
const extractionSchema = {
  type: Type.OBJECT,
  properties: {
    companyName: { type: Type.STRING, description: "Nombre legal o comercial de la empresa." },
    address: { type: Type.STRING, description: "Ubicación o dirección (Ciudad, País)." },
    companyType: { type: Type.STRING, description: "Tipo de entidad legal inferida (S.A., SAS, ONG, etc.)." },
    status: { type: Type.STRING, description: "Etapa de la empresa (Semilla, Crecimiento, Escalamiento)." },
    incorporationDate: { type: Type.STRING, description: "Fecha de constitución en formato YYYY-MM-DD. Si no se encuentra, dejar vacío." },
    amountRequired: { type: Type.STRING, description: "Monto de financiamiento buscado (solo números)." },
    financingType: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "Tipos de financiamiento mencionados. Mapear a: 'Equity (Acciones)', 'Deuda / Crédito', 'Grant / No Reembolsable', 'Híbrido'. O incluir tipos específicos detectados como 'Crowdfunding'." 
    },
    selectedOds: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Lista de ODS (ej: '1. Fin de la Pobreza') que mejor se alinean con la misión del documento."
    }
  }
};

const financialMetricsSchema = {
  type: Type.OBJECT,
  properties: {
    van: { type: Type.STRING, description: "Valor Actual Neto (VAN) o NPV encontrado en el documento. Incluir moneda." },
    tir: { type: Type.STRING, description: "Tasa Interna de Retorno (TIR) o IRR encontrada. Incluir porcentaje." },
    ebitda: { type: Type.STRING, description: "EBITDA anual más reciente o proyectado. Incluir moneda." }
  },
  required: ['van', 'tir', 'ebitda']
};

interface SearchResultItem {
  title: string;
  link: string;
  snippet: string;
}

/**
 * Realiza una búsqueda en Google Custom Search API.
 */
async function performCustomSearch(query: string, signal?: AbortSignal): Promise<SearchResultItem[]> {
  if (signal?.aborted) {
     throw new DOMException('Aborted', 'AbortError');
  }

  if (!SEARCH_ENGINE_ID) {
    console.warn("SEARCH_ENGINE_ID no está definido. Saltando búsqueda web y usando modo generativo.");
    return [];
  }

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { signal });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.warn("Error en Custom Search API:", errorData);
      throw new Error(`Custom Search API Error: ${response.status}`);
    }

    const data = await response.json();
    return (data.items || []).map((item: any) => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet
    }));
  } catch (error: any) {
    if (error.name === 'AbortError') throw error;
    console.error("Fallo al realizar la búsqueda web:", error);
    return [];
  }
}

/**
 * Procesa resultados de búsqueda (o un prompt generativo) usando Gemini para extraer datos estructurados.
 */
async function processWithGemini(promptContext: string, isSearchBased: boolean, signal?: AbortSignal): Promise<Fund[]> {
  const maxRetries = 3;
  
  // Si es basado en búsqueda, el prompt cambia ligeramente para enfocarse en extracción
  const baseInstruction = isSearchBased 
    ? `Actúa como un analista de datos para FutureFund. Tu objetivo es EXTRAER, DISCRIMINAR y FORMATEAR información de los siguientes resultados de búsqueda web.
       Solo incluye entidades que sean relevantes para la búsqueda de financiamiento (Fondos, DAFs, VCs, Bancos de Desarrollo).
       Si la información en los resultados es insuficiente, ignora ese resultado. No inventes datos.`
    : `Actúa como un consultor experto en financiamiento sostenible. Genera una lista de entidades basada en tu conocimiento actualizado.`;

  const fullPrompt = `${baseInstruction}\n\nCONTEXTO:\n${promptContext}`;

  for (let i = 0; i < maxRetries; i++) {
    if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: fullPrompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: fullResponseSchema,
            temperature: 0.1, // Baja temperatura para extracción precisa
        },
      });

      const jsonText = response.text?.trim();
      if (!jsonText) return [];
      
      const parsedData = JSON.parse(jsonText);
      return Array.isArray(parsedData) ? (parsedData as Fund[]) : [];

    } catch (error: any) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      console.warn(`Intento Gemini ${i + 1} falló:`, error.message);
      
      const isRetryable = error.message?.includes('503') || error.status === 503 || error.code === 503 || error.message?.includes('UNAVAILABLE');
      if (isRetryable && i < maxRetries - 1) {
        const waitTime = 2000 * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      break;
    }
  }
  return [];
}

/**
 * Orquestador: Intenta buscar en web -> Extraer. Si falla, usa generativo.
 */
async function searchAndExtract(searchQuery: string, generativeFallbackPrompt: string, signal?: AbortSignal): Promise<Fund[]> {
  // Check abort before starting
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  // 1. Intentar búsqueda web
  const searchResults = await performCustomSearch(searchQuery, signal);
  
  // Check abort after search
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  
  if (searchResults.length > 0) {
    console.log(`Procesando ${searchResults.length} resultados de búsqueda para: "${searchQuery}"`);
    const searchContext = JSON.stringify(searchResults, null, 2);
    return processWithGemini(searchContext, true, signal);
  }

  // 2. Fallback a generativo si no hay resultados o falló la API de búsqueda
  console.log("Usando fallback generativo para:", searchQuery);
  return processWithGemini(generativeFallbackPrompt, false, signal);
}

// --- Helpers de Contexto de Perfil ---

const getProfileContext = (profile?: CompanyProfile) => {
  if (!profile) return {
    keywords: "sustainable development environment circular economy",
    types: "Donor Advised Funds",
    ods: "General Sustainability"
  };

  const financingMap: Record<string, string> = {
    "Equity (Acciones)": "Venture Capital Impact Investors",
    "Deuda / Crédito": "Impact Debt Funds Green Loans",
    "Grant / No Reembolsable": "Grants Donor Advised Funds Foundations",
    "Híbrido": "Blended Finance Catalytic Capital"
  };

  // Logic to handle both mapped standard types and custom user types
  const types = profile.financingType
    .map(t => financingMap[t] || t) // If no map exists (custom type), use the type as is
    .join(" ");
  
  // Extract main keywords from ODS (remove numbers like "1. ")
  const odsKeywords = profile.selectedOds
    .map(ods => ods.replace(/^\d+\.\s*/, ''))
    .join(" ");

  return {
    keywords: `${odsKeywords} ${types}`,
    types: types,
    ods: profile.selectedOds.join(", ")
  };
};

/**
 * Extrae datos estructurados del PDF (Brief) para autocompletar el formulario.
 */
export const extractDataFromBrief = async (fileBase64: string, mimeType: string): Promise<Partial<CompanyProfile>> => {
    // Strip prefix
    const base64Data = fileBase64.split(',')[1] || fileBase64;

    const promptText = `
    Analiza este documento (Brief Ejecutivo / Presentación de Empresa).
    Extrae la información clave para llenar un perfil corporativo.
    
    REGLAS DE EXTRACCIÓN:
    1. Si no encuentras un dato exacto, intenta inferirlo del contexto o déjalo vacío.
    2. Para 'financingType', clasifica en: "Equity (Acciones)", "Deuda / Crédito", "Grant / No Reembolsable", "Híbrido". Si detectas otro mecanismo específico (ej. "Crowdfunding", "Royalty", "Leasing"), AGRÉGALO a la lista tal cual aparece.
    3. Para 'selectedOds', selecciona de la lista oficial de 17 ODS (ej: "13. Acción por el Clima") los que más se alinean.
    4. Para 'incorporationDate', busca fechas de fundación. Formato YYYY-MM-DD.
    5. Para 'amountRequired', extrae solo el número principal de la ronda buscada.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    inlineData: {
                        mimeType: mimeType,
                        data: base64Data
                    }
                },
                { text: promptText }
            ],
            config: {
                responseMimeType: "application/json",
                responseSchema: extractionSchema
            }
        });

        const text = response.text?.trim();
        if (!text) return {};
        
        return JSON.parse(text) as Partial<CompanyProfile>;
    } catch (e) {
        console.error("Error extrayendo datos del brief:", e);
        return {};
    }
};

/**
 * Extrae métricas financieras del documento financiero.
 */
export const extractFinancialMetrics = async (fileBase64: string, mimeType: string): Promise<FinancialMetrics> => {
    // Strip prefix
    const base64Data = fileBase64.split(',')[1] || fileBase64;

    const promptText = `
    Analiza este documento financiero.
    Tu objetivo es extraer indicadores clave de rendimiento (KPIs) si existen en el documento.
    
    Busca específicamente:
    1. Valor Actual Neto (VAN) o Net Present Value (NPV).
    2. Tasa Interna de Retorno (TIR) o Internal Rate of Return (IRR).
    3. EBITDA (Earnings Before Interest, Taxes, Depreciation, and Amortization).
    
    Si no encuentras el valor exacto, responde con "No identificado".
    Mantén el formato de moneda o porcentaje si está presente.
    `;

    try {
        let contents = [];
        
        // Handle PDF/Images via inlineData, Text/CSV via text prompt (decoded)
        if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
            contents = [
                {
                    inlineData: {
                        mimeType: mimeType,
                        data: base64Data
                    }
                },
                { text: promptText }
            ];
        } else {
             // Assume text based (CSV, TXT, JSON) and decode
             // NOTE: base64Data is coming from FileReader or btoa(csv)
             try {
                const decodedText = decodeURIComponent(escape(atob(base64Data)));
                contents = [
                    { text: `CONTENIDO DEL ARCHIVO FINANCIERO (${mimeType}):\n${decodedText}` },
                    { text: promptText }
                ];
             } catch (e) {
                console.warn("Failed to decode text file, trying inlineData fallback", e);
                contents = [
                    {
                        inlineData: {
                            mimeType: 'text/plain', // Force text plain if unknown
                            data: base64Data
                        }
                    },
                    { text: promptText }
                ];
             }
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: contents,
            config: {
                responseMimeType: "application/json",
                responseSchema: financialMetricsSchema
            }
        });

        const text = response.text?.trim();
        if (!text) return { van: "No identificado", tir: "No identificado", ebitda: "No identificado" };
        
        return JSON.parse(text) as FinancialMetrics;
    } catch (e) {
        console.error("Error extrayendo métricas financieras:", e);
        return { van: "Error", tir: "Error", ebitda: "Error" };
    }
};

/**
 * Genera un perfil ejecutivo de la empresa basado en los datos del formulario de onboarding y el documento adjunto.
 */
export const generateCompanyProfileSummary = async (profileData: CompanyProfile): Promise<string> => {
    let contents = [];

    // System instruction part
    const promptText = `
      Actúa como un experto en redacción de negocios para FutureFund.
      
      Tienes los siguientes metadatos de una empresa que busca financiamiento:
      - Nombre: ${profileData.companyName}
      - Tipo Legal: ${profileData.companyType}
      - Etapa/Estado: ${profileData.status}
      - Tipo de Financiamiento buscado: ${profileData.financingType.join(', ')}
      - Monto Requerido: $${profileData.amountRequired}
      - Objetivos de Desarrollo Sostenible (ODS) priorizados: ${profileData.selectedOds.join(', ')}
      
      ${profileData.financialMetrics ? `
      DATOS FINANCIEROS CLAVE DETECTADOS (Usa estos como referencia):
      - VAN: ${profileData.financialMetrics.van}
      - TIR: ${profileData.financialMetrics.tir}
      - EBITDA: ${profileData.financialMetrics.ebitda}
      ` : ''}
      
      IMPORTANTE: Se adjuntan documentos (Brief o Estados Financieros). 
      Debes PRIORIZAR la información contenida en estos archivos adjuntos por sobre los metadatos anteriores si hay discrepancias o mayor detalle.
      
      Tu tarea es escribir un "Resumen Ejecutivo" profesional actualizado.
      
      ESTRUCTURA OBLIGATORIA:
      Debes estructurar tu respuesta en EXACTAMENTE dos partes, usando estos encabezados exactos:

      ## GENERALIDADES DE LA EMPRESA
      [Aquí escribe un párrafo describiendo la misión, propuesta de valor y modelo de impacto de la empresa basándote principalmente en el Brief adjunto si existe.]

      ## ESTADO FINANCIERO
      Genera el análisis financiero siguiendo ESTRICTAMENTE este formato de presentación (básate en los documentos adjuntos, extrae la tabla si existe):

      **TABLA DE FLUJO Y METRICAS:**
      | Concepto | Año 1 | Año 2 | Año 3 | Año 4 | Año 5 |
      |---|---|---|---|---|---|
      | Inversión/Flujo | [Valor] | [Valor] | [Valor] | [Valor] | [Valor] |
      | EBITDA | [Valor] | [Valor] | [Valor] | [Valor] | [Valor] |
      | Margen EBITDA/Ventas | [Ratio] | [Ratio] | [Ratio] | [Ratio] | [Ratio] |

      **INDICADORES DE RENTABILIDAD:**
      | Indicador | Resultado | Análisis |
      |---|---|---|
      | VAN | [Valor] | [Breve interpretación del valor creado] |
      | TIR | [%] | [Breve interpretación de rentabilidad] |
      | Recuperación | [Tiempo] | [Interpretación de velocidad de retorno] |
      | Riesgo | [Nivel] | [Interpretación de mitigación/cobertura] |

      **RESUMEN DEL ANÁLISIS:**
      1. [Análisis sobre EBITDA inicial y estructura de costos]
      2. [Análisis sobre el punto de recuperación de inversión]
      3. [Observación sobre la tendencia de crecimiento y sostenibilidad]
      4. [Evaluación de los márgenes operativos y eficiencia]
      5. [Conclusión operativa general]
    `;

    // 1. Agregar Brief si existe (NUEVO ARCHIVO SUSTITUTIVO)
    if (profileData.briefFileBase64 && profileData.briefMimeType) {
        const base64Data = profileData.briefFileBase64.split(',')[1] || profileData.briefFileBase64;
        contents.push({
            inlineData: {
                mimeType: profileData.briefMimeType,
                data: base64Data
            }
        });
    }

    // 2. Agregar Financieros si existe (NUEVO ARCHIVO SUSTITUTIVO)
    if (profileData.financialsFileBase64 && profileData.financialsMimeType) {
        const base64Data = profileData.financialsFileBase64.split(',')[1] || profileData.financialsFileBase64;
        
        // Si es PDF o Imagen, usamos inlineData
        if (profileData.financialsMimeType === 'application/pdf' || profileData.financialsMimeType.startsWith('image/')) {
            contents.push({
                inlineData: {
                    mimeType: profileData.financialsMimeType,
                    data: base64Data
                }
            });
        } else {
            // Si es texto/csv/json, lo decodificamos y pasamos como bloque de texto
            try {
                const decodedText = decodeURIComponent(escape(atob(base64Data)));
                contents.push({ text: `\n\n[ARCHIVO ESTADOS FINANCIEROS (Actualizado)]:\n${decodedText}` });
            } catch (e) {
                 console.warn("Error decoding financial text file for summary", e);
                 contents.push({
                    inlineData: {
                        mimeType: 'text/plain',
                        data: base64Data
                    }
                });
            }
        }
    }

    // 3. Agregar el prompt al final
    contents.push({ text: promptText });
  
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: contents,
      });
      return response.text?.trim() || "Perfil generado no disponible.";
    } catch (error) {
      console.error("Error generating company summary:", error);
      return "No se pudo generar el resumen ejecutivo. Verifique que los archivos adjuntos sean válidos.";
    }
};

// --- Funciones Públicas Exportadas ---

export const getDemoData = (): Fund[] => {
  return [
    {
      nombre_fondo: "The ImpactAssets Donor Advised Fund",
      gestor_activos: "ImpactAssets",
      ticker_isin: "DAF Privado",
      url_fuente: "https://www.impactassets.org/",
      fecha_scrapeo: new Date().toISOString(),
      alineacion_detectada: {
        ods_encontrados: ["ODS 13: Acción por el Clima", "ODS 5: Igualdad de Género", "ODS 10: Reducción de las Desigualdades"],
        keywords_encontradas: ["Catalytic Capital", "Climate Solutions", "Gender Equity", "Impact Investing"],
        puntuacion_impacto: "Alta. Especializado 100% en inversión de impacto y soluciones climáticas complejas."
      },
      evidencia_texto: "ImpactAssets es el principal DAF para inversores de impacto, permitiendo inversiones personalizadas en fondos privados de deuda y capital alineados con los ODS."
    },
    {
      nombre_fondo: "Fidelity Charitable Impact Investing",
      gestor_activos: "Fidelity Charitable",
      ticker_isin: "N/A",
      url_fuente: "https://www.fidelitycharitable.org/giving-account/investment-options/impact-investing.html",
      fecha_scrapeo: new Date().toISOString(),
      alineacion_detectada: {
        ods_encontrados: ["ODS 8: Trabajo Decente", "ODS 6: Agua Limpia", "ODS 12: Producción Responsable"],
        keywords_encontradas: ["Sustainable Pools", "ESG", "Public Markets", "Grantmaking"],
        puntuacion_impacto: "Media-Alta. Ofrece pools de inversión ESG y facilita donaciones internacionales a través de intermediarios."
      },
      evidencia_texto: "Ofrece opciones de inversión de impacto que consideran factores ambientales, sociales y de gobernanza (ESG) junto con rendimientos financieros."
    },
    {
      nombre_fondo: "RSF Social Finance Donor Advised Fund",
      gestor_activos: "RSF Social Finance",
      ticker_isin: "DAF Boutique",
      url_fuente: "https://rsfsocialfinance.org/give/donor-advised-funds/",
      fecha_scrapeo: new Date().toISOString(),
      alineacion_detectada: {
        ods_encontrados: ["ODS 2: Hambre Cero", "ODS 12: Economía Circular"],
        keywords_encontradas: ["Regenerative Economy", "Soil Health", "Fair Trade"],
        puntuacion_impacto: "Muy Alta. Enfoque exclusivo en economía regenerativa, sistemas alimentarios y justicia ecológica."
      },
      evidencia_texto: "Un DAF diseñado para donantes que desean activar su capital inmediatamente para apoyar empresas sociales y justicia ecológica."
    }
  ];
};

export const discoverFinancingSources = async (signal?: AbortSignal, profile?: CompanyProfile): Promise<Fund[]> => {
  const ctx = getProfileContext(profile);
  
  // Update search query to use profile types directly if available, maximizing custom input
  const searchQuery = profile 
    ? `top ${ctx.types} financing for ${ctx.keywords} global list`
    : "top donor advised funds for sustainable development environment circular economy list";
  
  const fallbackPrompt = `
    Identifica y lista fuentes de financiamiento globales alineadas con: ${ctx.ods}.
    
    Tipos de entidad prioritarios (Basado en perfil): ${ctx.types}.
    
    Si el usuario busca 'Equity', incluye Venture Capital de Impacto o Angel Networks.
    Si el usuario busca 'Deuda', incluye Fondos de Deuda Privada o Green Bonds.
    Si el usuario busca 'Grants', incluye DAFs, Fundaciones y Family Offices.
    Si el usuario usa un término personalizado como 'Crowdfunding' o 'Royalty', busca plataformas específicas de ese tipo.

    Prioriza organizaciones que operen internacionalmente.
    Genera 10 resultados.
  `;

  return searchAndExtract(searchQuery, fallbackPrompt, signal);
};

export const expandSearch = async (initialFunds: Fund[], signal?: AbortSignal, profile?: CompanyProfile): Promise<Fund[]> => {
  const ctx = getProfileContext(profile);
  
  // More specific niche search
  const searchQuery = profile
    ? `niche ${ctx.types} for ${ctx.keywords} impact investing list`
    : "niche donor advised funds impact investing sponsors list environment social governance";

  const fallbackPrompt = `
    Expande la búsqueda encontrando OTROS financistas diferentes a los ya conocidos.
    Enfoque: ${ctx.keywords}.
    
    Busca entidades especializadas o de nicho que ofrezcan ${ctx.types}.
    Ejemplos: Impact Investing Intermediaries, Family Offices con programas abiertos, Fondos Temáticos.
    
    Genera 10 resultados nuevos.
  `;

  return searchAndExtract(searchQuery, fallbackPrompt, signal);
};

export const discoverEcuadorFinancingSources = async (signal?: AbortSignal, profile?: CompanyProfile): Promise<Fund[]> => {
  const ctx = getProfileContext(profile);
  
  const searchQuery = profile
    ? `financing sources for ${ctx.keywords} in Ecuador ${ctx.types} list`
    : "fiscal sponsorship for Ecuador non-profits US donors organizations list";

  const fallbackPrompt = `
    Identifica fuentes de financiamiento DISPONIBLES PARA ECUADOR alineadas con: ${ctx.ods}.
    Tipo: ${ctx.types}.
    
    Busca:
    1. Organismos Multilaterales (BID, CAF).
    2. Fiscal Sponsors que acepten proyectos ecuatorianos (ej. GlobalGiving).
    3. Fondos de Inversión locales o regionales (Latam).
    
    Genera 6 resultados.
  `;

  return searchAndExtract(searchQuery, fallbackPrompt, signal);
};

export const expandEcuadorSearch = async (initialFunds: Fund[], signal?: AbortSignal, profile?: CompanyProfile): Promise<Fund[]> => {
  const ctx = getProfileContext(profile);
  
  const searchQuery = profile
    ? `international grants and investors for ${ctx.keywords} Ecuador projects`
    : "grants for sustainable development projects in Ecuador international ngos list";

  const fallbackPrompt = `
    Encuentra OTRAS fuentes para Ecuador no listadas antes.
    Enfoque: ${ctx.ods}.
    
    Busca: Redes de Inversión de Impacto (Latimpacto), Cooperación Internacional Descentralizada, Crowdfunding.
    Genera 6 resultados nuevos.
  `;

  return searchAndExtract(searchQuery, fallbackPrompt, signal);
};

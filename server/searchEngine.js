// Search Engine Module
// Wrapper around Gemini Service for the API server

const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const API_KEY = process.env.API_KEY;
const SEARCH_ENGINE_ID = process.env.SEARCH_ENGINE_ID;

/**
 * Perform Google Custom Search
 */
async function performCustomSearch(query) {
  if (!SEARCH_ENGINE_ID || !API_KEY) {
    throw new Error('Missing API_KEY or SEARCH_ENGINE_ID');
  }

  const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&num=10`;
  
  const response = await fetch(url);
  const data = await response.json();

  if (!data.items) return [];

  return data.items.map(item => ({
    title: item.title,
    link: item.link,
    snippet: item.snippet
  }));
}

/**
 * Analyze search results with Gemini
 */
async function analyzeWithGemini(searchResults, context) {
  const model = ai.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
    }
  });

  const prompt = `
Analiza los siguientes resultados de búsqueda y extrae información sobre fondos de inversión, 
DAFs, grants, o instituciones financiadoras que puedan ser relevantes para: ${context}

Resultados:
${JSON.stringify(searchResults, null, 2)}

Devuelve un array JSON con fondos encontrados, cada uno con:
- nombre_fondo: string
- gestor_activos: string
- ticker_isin: string
- url_fuente: string
- fecha_scrapeo: string (ISO)
- alineacion_detectada: { ods_encontrados: string[], keywords_encontradas: string[], puntuacion_impacto: string }
- evidencia_texto: string
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('Error parsing Gemini response:', e);
    return [];
  }
}

/**
 * Perform global search for funding sources
 */
async function performGlobalSearch(profile) {
  const queries = [
    'donor advised funds impact investing SDG',
    'venture capital social impact funds',
    'philanthropic foundations sustainable development',
    'impact investment funds environmental'
  ];

  const allFunds = [];

  for (const query of queries) {
    try {
      const searchResults = await performCustomSearch(query);
      const funds = await analyzeWithGemini(
        searchResults, 
        profile?.selectedOds?.join(', ') || 'sustainable development'
      );
      allFunds.push(...funds);
    } catch (error) {
      console.error(`Error in global search for "${query}":`, error);
    }
  }

  return allFunds;
}

/**
 * Perform Ecuador-specific search
 */
async function performEcuadorSearch(profile) {
  const queries = [
    'financiamiento Ecuador startups emprendimientos',
    'fondos inversión Ecuador impacto social',
    'cooperación internacional Ecuador ODS',
    'BanEcuador CFN financiamiento empresas'
  ];

  const allFunds = [];

  for (const query of queries) {
    try {
      const searchResults = await performCustomSearch(query);
      const funds = await analyzeWithGemini(
        searchResults,
        `Ecuador - ${profile?.selectedOds?.join(', ') || 'desarrollo sostenible'}`
      );
      allFunds.push(...funds);
    } catch (error) {
      console.error(`Error in Ecuador search for "${query}":`, error);
    }
  }

  return allFunds;
}

module.exports = {
  performGlobalSearch,
  performEcuadorSearch,
  performCustomSearch,
  analyzeWithGemini
};

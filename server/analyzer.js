// Analyzer Module
// Fund application analysis using Gemini

const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Analyze fund application requirements
 */
async function analyzeFund(fund) {
  try {
    const model = ai.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });

    const prompt = `
Analiza la siguiente información sobre un fondo y determina los requisitos para aplicar:

Fondo: ${fund.nombre_fondo}
Gestor: ${fund.gestor_activos}
URL: ${fund.url_fuente}
Evidencia: ${fund.evidencia_texto}

Por favor determina:
1. es_elegible: "Sí" o "No" (si hay información sobre cómo aplicar)
2. resumen_requisitos: array de strings con requisitos principales
3. pasos_aplicacion: array de strings con pasos para aplicar
4. fechas_clave: string con fechas importantes
5. link_directo_aplicacion: string con URL directa
6. contact_emails: array de emails de contacto

Devuelve JSON con esta estructura.
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    return JSON.parse(text);
  } catch (error) {
    console.error(`Error analyzing fund ${fund.nombre_fondo}:`, error);
    return null;
  }
}

module.exports = {
  analyzeFund
};

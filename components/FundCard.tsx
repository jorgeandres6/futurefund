
import React, { useState } from 'react';
import { Fund, ApplicationAnalysis, CompanyProfile } from '../types';
import { analyzeFundApplication } from '../services/webReviewService';
import { saveFundAnalysis } from '../services/supabaseService';
import SpinnerIcon from './icons/SpinnerIcon';

interface FundCardProps {
  fund: Fund;
  userProfile?: CompanyProfile;
  userId?: string;
  onStatusUpdate: (fundName: string, status: string) => void;
  onAnalysisComplete?: (fundName: string, analysis: ApplicationAnalysis) => void;
}

const FundCard: React.FC<FundCardProps> = ({ fund, userProfile, userId, onStatusUpdate, onAnalysisComplete }) => {
  const [analysis, setAnalysis] = useState<ApplicationAnalysis | null>(fund.analisis_aplicacion || null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email sending states
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleAnalyzeClick = async () => {
    if (analysis) return; // Already analyzed

    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeFundApplication(fund.nombre_fondo, fund.url_fuente);
      if (result) {
        setAnalysis(result);
        
        // Save analysis to database
        if (userId) {
          try {
            await saveFundAnalysis(userId, fund.nombre_fondo, result);
            console.log('Análisis guardado en la base de datos');
            
            // Notify parent component about the completed analysis
            if (onAnalysisComplete) {
              onAnalysisComplete(fund.nombre_fondo, result);
            }
          } catch (dbError) {
            console.error('Error al guardar el análisis en la base de datos:', dbError);
            // No bloqueamos la UI por un error de guardado, pero lo registramos
          }
        }
      } else {
        setError("No se pudo extraer información clara de aplicación.");
      }
    } catch (err) {
      setError("Error al conectar con el servicio de análisis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleContact = async () => {
    if (!analysis?.contact_emails || analysis.contact_emails.length === 0) return;
    
    // Build email body based on CompanyProfile or generic fallback
    let subject = "Solicitud de Información sobre Financiamiento";
    let body = "";

    if (userProfile) {
        subject += ` - ${userProfile.companyName}`;
        
        // Construct HTML body
        body = `<p>Estimados <strong>${fund.nombre_fondo}</strong>,</p>`;
        body += `<p>Le saluda el equipo de <strong>${userProfile.companyName}</strong>, una organización de tipo ${userProfile.companyType || 'empresa'} ubicada en ${userProfile.address || 'Ecuador'}.</p>`;
        
        if (userProfile.aiGeneratedSummary) {
            // Convert plain text newlines to HTML breaks if present, and wrap nicely
            const summaryHtml = userProfile.aiGeneratedSummary.replace(/\n/g, '<br>');
            body += `<div style="background-color: #f3f4f6; padding: 15px; border-left: 4px solid #3b82f6; margin: 15px 0; color: #1f2937; font-style: italic;">${summaryHtml}</div>`;
        } else {
            body += `<p>Estamos enfocados en proyectos alineados con los Objetivos de Desarrollo Sostenible: <strong>${userProfile.selectedOds.join(', ')}</strong>.</p>`;
        }
        
        body += `<p>Actualmente estamos buscando oportunidades de financiamiento (<strong>${userProfile.financingType.join(', ')}</strong>) por un monto aproximado de <strong>$${userProfile.amountRequired}</strong>.</p>`;
        
        // --- HUMANIZED ANALYSIS CONTEXT INJECTION ---
        
        // Natural transition incorporating dates and eligibility if available
        let contextSentence = "Hemos revisado con interés su enfoque de inversión";
        if (analysis.fechas_clave && analysis.fechas_clave.length > 3) {
             contextSentence += ` y sus ciclos de aplicación (${analysis.fechas_clave})`;
        }
        contextSentence += ".";

        body += `<p style="margin-top: 15px;">${contextSentence} Entendemos que existen criterios de elegibilidad específicos (${analysis.es_elegible || 'para la región'}), por lo que antes de formalizar nuestra postulación, quisiéramos validar algunos puntos clave con su equipo:</p>`;

        body += `<ul style="margin-bottom: 20px;">`;
        
        // 1. Donors request (Conversational)
        body += `<li>¿Sería posible que nos faciliten acceso a un <strong>listado de donantes</strong> o aliados estratégicos de su red con quienes pudiéramos iniciar una conversación directa?</li>`;

        // 2. Requirements (Conversational)
        if (analysis.resumen_requisitos && analysis.resumen_requisitos.length > 0) {
            const reqs = analysis.resumen_requisitos.slice(0, 3).join(', ');
            body += `<li>Nos gustaría aclarar ciertos detalles sobre los requisitos mencionados, específicamente en cuanto a: <em>${reqs}</em>.</li>`;
        }

        // 3. Status Fit (Conversational)
        body += `<li>Agradeceríamos su confirmación sobre si una organización en etapa de <strong>${userProfile.status}</strong> se ajusta a sus prioridades actuales de financiamiento para Ecuador/Latinoamérica.</li>`;
        
        body += `</ul>`;
        
        body += `<p style="margin-top: 20px;">Atentamente,<br>Representante de <strong>${userProfile.companyName}</strong></p>`;
    } else {
        // Generic HTML body
        body = `<p>Estimados <strong>${fund.nombre_fondo}</strong>,</p>`;
        body += `<p>Estamos interesados en conocer más sobre sus oportunidades de financiamiento para proyectos sostenibles en Ecuador/Latinoamérica.</p>`;
        
        // Generic analysis context if available but no profile
        if (analysis) {
             body += `<p>En particular, nos gustaría recibir información sobre un posible <strong>listado de donantes</strong> o los pasos específicos para aplicar, dado que entendemos que sus fechas clave son: ${analysis.fechas_clave || 'No especificadas'}.</p>`;
        }

        body += `<p>Agradecemos su información.</p>`;
        body += `<p style="margin-top: 20px;">Saludos.</p>`;
    }

    setIsSendingEmail(true);
    setEmailStatus('idle');

    try {
        const payload = {
            correos: analysis.contact_emails,
            data: body,
            asunto: subject
        };

        const response = await fetch("https://hook.us2.make.com/ge6sut3l57rejjgphe7xirha1t0h31at", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            setEmailStatus('success');
            onStatusUpdate(fund.nombre_fondo, "CORREO DE PRIMER CONTACTO ENVIADO");
        } else {
            console.error("Webhook error:", response.status);
            setEmailStatus('error');
        }
    } catch (e) {
        console.error("Connection error:", e);
        setEmailStatus('error');
    } finally {
        setIsSendingEmail(false);
    }
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 shadow-md hover:shadow-lg hover:border-blue-500 transition-all duration-300 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row justify-between sm:items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-green-300">{fund.nombre_fondo}</h3>
          <p className="text-md text-gray-400">{fund.gestor_activos}</p>
        </div>
        <div className="mt-2 sm:mt-0 sm:text-right">
          <span className="inline-block bg-gray-700 text-gray-300 text-sm font-semibold px-3 py-1 rounded-full">
            {fund.ticker_isin}
          </span>
        </div>
      </div>

      <div className="mb-4 flex-grow">
        <p className="text-sm text-gray-400 italic border-l-4 border-gray-600 pl-4 py-2 bg-gray-900/50 rounded-r-md">
          "{fund.evidencia_texto}"
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-6">
        <div>
          <h4 className="font-semibold text-gray-300 mb-2">Alineación Detectada</h4>
          <div className="flex flex-wrap gap-2">
            {fund.alineacion_detectada.ods_encontrados.map(ods => (
              <span key={ods} className="bg-blue-900/70 text-blue-300 px-2.5 py-1 rounded-md text-xs font-medium">
                {ods}
              </span>
            ))}
            {fund.alineacion_detectada.keywords_encontradas.map(keyword => (
              <span key={keyword} className="bg-purple-900/70 text-purple-300 px-2.5 py-1 rounded-md text-xs font-medium">
                {keyword}
              </span>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-gray-300 mb-2">Puntuación de Impacto</h4>
          <p className="text-gray-400">{fund.alineacion_detectada.puntuacion_impacto}</p>
        </div>
      </div>

      {/* Application Analysis Section */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        {!analysis && !isAnalyzing && (
          <button
            onClick={handleAnalyzeClick}
            className="w-full py-2 px-4 bg-gray-700 hover:bg-blue-600 text-blue-100 text-sm font-semibold rounded-md transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            Analizar Proceso de Aplicación
          </button>
        )}

        {isAnalyzing && (
          <div className="flex justify-center items-center py-4 bg-gray-900/30 rounded-md">
            <SpinnerIcon className="w-5 h-5 text-blue-400 mr-3 animate-spin" />
            <span className="text-sm text-blue-300 animate-pulse">Analizando estructura web y guías...</span>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-xs mt-2 text-center">{error}</p>
        )}

        {analysis && (
          <div className="bg-blue-900/20 border border-blue-800/50 rounded-md p-4 mt-2">
            <h4 className="text-blue-300 font-bold text-sm mb-3 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Estrategia de Aplicación
            </h4>
            
            <div className="space-y-3 text-xs sm:text-sm text-gray-300">
              <div>
                <span className="text-gray-400 font-semibold block">Elegibilidad (Latam/Ecuador):</span>
                <p className="mt-1">{analysis.es_elegible}</p>
              </div>
              
              <div>
                <span className="text-gray-400 font-semibold block">Pasos:</span>
                <ul className="list-disc list-inside mt-1 pl-1 space-y-1 text-gray-300">
                  {analysis.pasos_aplicacion.slice(0, 3).map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between gap-2 mt-2 pt-2 border-t border-blue-800/30">
                 <div>
                    <span className="text-gray-400 font-semibold mr-1">Deadlines:</span>
                    <span className="text-blue-200">{analysis.fechas_clave}</span>
                 </div>
                 {analysis.link_directo_aplicacion && (
                   <a 
                     href={analysis.link_directo_aplicacion}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="text-green-400 hover:text-green-300 underline font-medium"
                   >
                     Ir a Guía/Portal
                   </a>
                 )}
              </div>
              
              {/* Contact Emails & Button Section */}
              {analysis.contact_emails && analysis.contact_emails.length > 0 && (
                <div className="mt-3 pt-3 border-t border-blue-800/30">
                  <div className="flex flex-col gap-2">
                    <span className="text-gray-400 font-semibold text-xs">Contactos Detectados:</span>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {analysis.contact_emails.map((email, i) => (
                        <span 
                          key={i} 
                          className="flex items-center gap-1 text-blue-200 text-xs bg-gray-800 px-2 py-1 rounded border border-gray-600"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                          </svg>
                          {email}
                        </span>
                      ))}
                    </div>

                    {userProfile && (
                        <button
                            onClick={handleContact}
                            disabled={isSendingEmail || emailStatus === 'success'}
                            className={`w-full flex items-center justify-center font-semibold py-2 px-3 rounded text-xs transition-all duration-200 shadow-md border ${
                                emailStatus === 'success' 
                                ? 'bg-green-900 text-green-200 border-green-700 cursor-default'
                                : emailStatus === 'error'
                                ? 'bg-red-900/50 text-red-200 border-red-700 hover:bg-red-800'
                                : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white border-green-500'
                            }`}
                        >
                            {isSendingEmail ? (
                                <>
                                    <SpinnerIcon className="w-4 h-4 mr-2 animate-spin" />
                                    Enviando...
                                </>
                            ) : emailStatus === 'success' ? (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Correo Enviado Exitosamente
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    {emailStatus === 'error' ? 'Error. Reintentar Envío' : 'Enviar Correo de Presentación'}
                                </>
                            )}
                        </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-700 flex flex-col sm:flex-row justify-between items-center text-xs text-gray-500">
        <a 
          href={fund.url_fuente} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-blue-400 hover:text-blue-300 hover:underline truncate max-w-xs mb-2 sm:mb-0"
        >
          URL Principal Detectada
        </a>
        <span>Extraído el: {new Date(fund.fecha_scrapeo).toLocaleString()}</span>
      </div>
    </div>
  );
};

export default FundCard;

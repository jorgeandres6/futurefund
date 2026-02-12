
import React, { useEffect, useState } from 'react';
import { Fund, HistoryEntry } from '../types';
import { getFundEmails } from '../services/supabaseService';

interface EmailTracking {
  id: string;
  email_type: string;
  from_email: string;
  to_email: string;
  email_body: string | null;
  date: string;
}

interface FundDetailModalProps {
  fund: Fund;
  userId: string;
  onClose: () => void;
}

const FundDetailModal: React.FC<FundDetailModalProps> = ({ fund, userId, onClose }) => {
  const [emails, setEmails] = useState<EmailTracking[]>([]);
  const [isLoadingEmails, setIsLoadingEmails] = useState(true);
  const [activeTab, setActiveTab] = useState<'general' | 'application' | 'emails' | 'history'>('general');

  useEffect(() => {
    const loadEmails = async () => {
      try {
        setIsLoadingEmails(true);
        const emailData = await getFundEmails(userId, fund.nombre_fondo);
        setEmails(emailData);
      } catch (error) {
        console.error('Error loading emails:', error);
      } finally {
        setIsLoadingEmails(false);
      }
    };

    loadEmails();
  }, [userId, fund.nombre_fondo]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const getEmailTypeLabel = (type: string) => {
    const normalized = type.toLowerCase();
    return normalized === 'sent' || normalized === 'enviado' 
      ? 'Enviado' 
      : 'Recibido';
  };

  const getEmailTypeColor = (type: string) => {
    const normalized = type.toLowerCase();
    return normalized === 'sent' || normalized === 'enviado'
      ? 'bg-blue-900/50 text-blue-300 border-blue-700'
      : 'bg-green-900/50 text-green-300 border-green-700';
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden border border-gray-700 animate-fade-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 p-6 border-b border-gray-700">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white mb-2">{fund.nombre_fondo}</h2>
              <p className="text-gray-300 text-sm">{fund.gestor_activos}</p>
              <div className="flex gap-2 mt-3">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  fund.alineacion_detectada.puntuacion_impacto.toLowerCase().includes('alta') || 
                  fund.alineacion_detectada.puntuacion_impacto.toLowerCase().includes('muy alta')
                    ? 'bg-green-900/50 text-green-300 border border-green-700'
                    : 'bg-yellow-900/50 text-yellow-300 border border-yellow-700'
                }`}>
                  {fund.alineacion_detectada.puntuacion_impacto}
                </span>
                {fund.applicationStatus && (
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    fund.applicationStatus === 'PENDIENTE'
                      ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-700'
                      : 'bg-green-900/50 text-green-300 border border-green-700'
                  }`}>
                    {fund.applicationStatus}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
              aria-label="Cerrar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 bg-gray-800/50">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-6 py-3 font-medium text-sm transition-colors ${
              activeTab === 'general'
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Información General
          </button>
          <button
            onClick={() => setActiveTab('application')}
            className={`px-6 py-3 font-medium text-sm transition-colors ${
              activeTab === 'application'
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Aplicación
          </button>
          <button
            onClick={() => setActiveTab('emails')}
            className={`px-6 py-3 font-medium text-sm transition-colors relative ${
              activeTab === 'emails'
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Emails
            {emails.length > 0 && (
              <span className="ml-2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                {emails.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 font-medium text-sm transition-colors relative ${
              activeTab === 'history'
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Historial
            {fund.history && fund.history.length > 0 && (
              <span className="ml-2 bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full">
                {fund.history.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-220px)]">
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="bg-gray-800/50 rounded-lg p-5 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Información Básica
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Ticker/ISIN</p>
                    <p className="text-white font-medium">{fund.ticker_isin}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Fecha de Búsqueda</p>
                    <p className="text-white font-medium">{formatDate(fund.fecha_scrapeo)}</p>
                  </div>
                  <div className="col-span-full">
                    <p className="text-gray-400 text-sm mb-1">URL Fuente</p>
                    <a 
                      href={fund.url_fuente} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 break-all underline"
                    >
                      {fund.url_fuente}
                    </a>
                  </div>
                </div>
              </div>

              {/* ODS */}
              <div className="bg-gray-800/50 rounded-lg p-5 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  ODS Detectados
                </h3>
                <div className="flex flex-wrap gap-2">
                  {fund.alineacion_detectada.ods_encontrados.map((ods, idx) => (
                    <span 
                      key={idx}
                      className="bg-purple-900/30 text-purple-300 px-3 py-1.5 rounded-lg border border-purple-700 text-sm"
                    >
                      {ods}
                    </span>
                  ))}
                </div>
              </div>

              {/* Keywords */}
              <div className="bg-gray-800/50 rounded-lg p-5 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  Keywords Encontradas
                </h3>
                <div className="flex flex-wrap gap-2">
                  {fund.alineacion_detectada.keywords_encontradas.map((keyword, idx) => (
                    <span 
                      key={idx}
                      className="bg-green-900/30 text-green-300 px-3 py-1.5 rounded-lg border border-green-700 text-sm"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>

              {/* Evidence */}
              <div className="bg-gray-800/50 rounded-lg p-5 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Evidencia Textual
                </h3>
                <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {fund.evidencia_texto || 'No hay evidencia textual disponible'}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'application' && (
            <div className="space-y-6">
              {fund.analisis_aplicacion ? (
                <>
                  {/* Eligibility */}
                  <div className="bg-gray-800/50 rounded-lg p-5 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Elegibilidad
                    </h3>
                    <p className="text-gray-300">{fund.analisis_aplicacion.es_elegible}</p>
                  </div>

                  {/* Requirements */}
                  {fund.analisis_aplicacion.resumen_requisitos.length > 0 && (
                    <div className="bg-gray-800/50 rounded-lg p-5 border border-gray-700">
                      <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Requisitos
                      </h3>
                      <ul className="space-y-2">
                        {fund.analisis_aplicacion.resumen_requisitos.map((req, idx) => (
                          <li key={idx} className="flex items-start text-gray-300">
                            <span className="text-yellow-400 mr-2">•</span>
                            <span>{req}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Application Steps */}
                  {fund.analisis_aplicacion.pasos_aplicacion.length > 0 && (
                    <div className="bg-gray-800/50 rounded-lg p-5 border border-gray-700">
                      <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        Pasos de Aplicación
                      </h3>
                      <ol className="space-y-2">
                        {fund.analisis_aplicacion.pasos_aplicacion.map((paso, idx) => (
                          <li key={idx} className="flex items-start text-gray-300">
                            <span className="bg-green-900/50 text-green-300 rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 flex-shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span>{paso}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Key Dates */}
                  {fund.analisis_aplicacion.fechas_clave && (
                    <div className="bg-gray-800/50 rounded-lg p-5 border border-gray-700">
                      <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Fechas Clave
                      </h3>
                      <p className="text-gray-300">{fund.analisis_aplicacion.fechas_clave}</p>
                    </div>
                  )}

                  {/* Application Link */}
                  {fund.analisis_aplicacion.link_directo_aplicacion && (
                    <div className="bg-gray-800/50 rounded-lg p-5 border border-gray-700">
                      <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Link de Aplicación
                      </h3>
                      <a 
                        href={fund.analisis_aplicacion.link_directo_aplicacion}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 break-all underline"
                      >
                        {fund.analisis_aplicacion.link_directo_aplicacion}
                      </a>
                    </div>
                  )}

                  {/* Contact Emails */}
                  {fund.analisis_aplicacion.contact_emails.length > 0 && (
                    <div className="bg-gray-800/50 rounded-lg p-5 border border-gray-700">
                      <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Emails de Contacto
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {fund.analisis_aplicacion.contact_emails.map((email, idx) => (
                          <a
                            key={idx}
                            href={`mailto:${email}`}
                            className="bg-red-900/30 text-red-300 px-3 py-1.5 rounded-lg border border-red-700 text-sm hover:bg-red-900/50 transition-colors"
                          >
                            {email}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-400 text-lg">No hay información de aplicación disponible</p>
                  <p className="text-gray-500 text-sm mt-2">Analiza el fondo para obtener detalles de aplicación</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'emails' && (
            <div className="space-y-4">
              {isLoadingEmails ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
              ) : emails.length > 0 ? (
                emails.map((email) => (
                  <div key={email.id} className="bg-gray-800/50 rounded-lg p-5 border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getEmailTypeColor(email.email_type)}`}>
                        {getEmailTypeLabel(email.email_type)}
                      </span>
                      <span className="text-gray-400 text-sm">{formatDate(email.date)}</span>
                    </div>
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center text-sm">
                        <span className="text-gray-400 w-20">De:</span>
                        <span className="text-gray-200">{email.from_email}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <span className="text-gray-400 w-20">Para:</span>
                        <span className="text-gray-200">{email.to_email}</span>
                      </div>
                    </div>
                    {email.email_body && (
                      <div className="bg-gray-900/50 rounded p-4 mt-3">
                        <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
                          {email.email_body}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-400 text-lg">No hay emails registrados</p>
                  <p className="text-gray-500 text-sm mt-2">Los emails enviados y recibidos aparecerán aquí</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              {fund.history && fund.history.length > 0 ? (
                fund.history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((entry, index) => (
                  <div key={index} className="bg-gray-800/50 rounded-lg p-5 border border-gray-700">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {entry.type === 'email_sent' && (
                          <div className="bg-blue-900/50 p-2 rounded-lg">
                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        {entry.type === 'email_received' && (
                          <div className="bg-green-900/50 p-2 rounded-lg">
                            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                            </svg>
                          </div>
                        )}
                        {entry.type === 'form_filled' && (
                          <div className="bg-purple-900/50 p-2 rounded-lg">
                            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                        )}
                        {entry.type === 'note' && (
                          <div className="bg-yellow-900/50 p-2 rounded-lg">
                            <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </div>
                        )}
                        {entry.type === 'call' && (
                          <div className="bg-indigo-900/50 p-2 rounded-lg">
                            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                          </div>
                        )}
                        {entry.type === 'meeting' && (
                          <div className="bg-red-900/50 p-2 rounded-lg">
                            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </div>
                        )}
                        <div>
                          <h4 className="text-white font-medium">{entry.description}</h4>
                          <span className="text-gray-400 text-sm">{formatDate(entry.date)}</span>
                        </div>
                      </div>
                    </div>
                    {entry.details && Object.keys(entry.details).length > 0 && (
                      <div className="bg-gray-900/50 rounded p-4 mt-3">
                        {entry.details.from && (
                          <div className="flex text-sm mb-2">
                            <span className="text-gray-400 w-24">De:</span>
                            <span className="text-gray-300">{entry.details.from}</span>
                          </div>
                        )}
                        {entry.details.to && (
                          <div className="flex text-sm mb-2">
                            <span className="text-gray-400 w-24">Para:</span>
                            <span className="text-gray-300">{entry.details.to}</span>
                          </div>
                        )}
                        {entry.details.subject && (
                          <div className="flex text-sm mb-2">
                            <span className="text-gray-400 w-24">Asunto:</span>
                            <span className="text-gray-300">{entry.details.subject}</span>
                          </div>
                        )}
                        {entry.details.body && (
                          <div className="mt-3">
                            <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
                              {entry.details.body}
                            </p>
                          </div>
                        )}
                        {entry.details.form_name && (
                          <div className="flex text-sm mb-2">
                            <span className="text-gray-400 w-24">Formulario:</span>
                            <span className="text-gray-300">{entry.details.form_name}</span>
                          </div>
                        )}
                        {entry.details.notes && (
                          <div className="mt-3">
                            <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
                              {entry.details.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-400 text-lg">No hay historial registrado</p>
                  <p className="text-gray-500 text-sm mt-2">Las comunicaciones y actividades aparecerán aquí</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-800/50 p-4 border-t border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default FundDetailModal;

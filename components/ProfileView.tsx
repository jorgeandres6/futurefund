
import React, { useState } from 'react';
import { CompanyProfile } from '../types';
import { extractDataFromBrief, extractFinancialMetrics, generateCompanyProfileSummary } from '../services/geminiService';
import SpinnerIcon from './icons/SpinnerIcon';

interface ProfileViewProps {
  profile: CompanyProfile;
  onUpdateProfile: (updatedProfile: CompanyProfile) => void;
}

const financingOptions = [
  "Equity (Acciones)",
  "Deuda / Crédito",
  "Grant / No Reembolsable",
  "Híbrido"
];

const odsList = [
  "1. Fin de la Pobreza",
  "2. Hambre Cero",
  "3. Salud y Bienestar",
  "4. Educación de Calidad",
  "5. Igualdad de Género",
  "6. Agua Limpia y Saneamiento",
  "7. Energía Asequible y No Contaminante",
  "8. Trabajo Decente y Crecimiento Económico",
  "9. Industria, Innovación e Infraestructura",
  "10. Reducción de las Desigualdades",
  "11. Ciudades y Comunidades Sostenibles",
  "12. Producción y Consumo Responsables",
  "13. Acción por el Clima",
  "14. Vida Submarina",
  "15. Vida de Ecosistemas Terrestres",
  "16. Paz, Justicia e Instituciones Sólidas",
  "17. Alianzas para lograr los Objetivos"
];

// Helper to render structured markdown (Tables, headers, lists)
const renderFormattedContent = (text: string) => {
  if (!text) return <p className="text-gray-500 italic">Sin información disponible.</p>;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let tableBuffer: string[] = [];
  let inTable = false;

  const flushTable = (keyPrefix: number) => {
    if (tableBuffer.length === 0) return null;
    
    // Filter standard markdown separator lines (e.g. |---|---|)
    const dataRows = tableBuffer.filter(row => !row.match(/^\|[\s-]+\|/) && row.trim().length > 0);
    
    if (dataRows.length === 0) return null;

    // Parse headers (assume first row is header)
    // We expect lines like: | Header 1 | Header 2 |
    const headers = dataRows[0].split('|').slice(1, -1).map(h => h.trim());
    const bodyRows = dataRows.slice(1).map(row => row.split('|').slice(1, -1).map(c => c.trim()));

    return (
      <div key={`table-${keyPrefix}`} className="overflow-x-auto my-4 rounded-lg border border-gray-700 shadow-lg">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-gray-900 text-gray-300 uppercase text-xs font-semibold tracking-wider">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="px-6 py-3 border-b border-gray-700 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700 bg-gray-800">
            {bodyRows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-700/50 transition-colors">
                {row.map((cell, j) => (
                  <td key={j} className={`px-6 py-3 whitespace-nowrap ${j === 0 ? 'font-medium text-blue-200' : 'text-gray-300'}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    // Detect table row: starts and ends with |
    const isTableRow = trimmed.startsWith('|') && trimmed.endsWith('|');

    if (isTableRow) {
      if (!inTable) inTable = true;
      tableBuffer.push(trimmed);
    } else {
      // If we were in a table and hit a non-table line, flush the table
      if (inTable) {
        elements.push(flushTable(i));
        tableBuffer = [];
        inTable = false;
      }

      if (trimmed) {
          // Detect Headers (**Title**)
          if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
               elements.push(
                 <h4 key={i} className="text-blue-300 font-bold mt-5 mb-2 text-md border-l-2 border-blue-500 pl-3">
                    {trimmed.replace(/\*\*/g, '')}
                 </h4>
               );
          } 
          // Detect numbered lists (1. Text)
          else if (trimmed.match(/^\d+\./)) {
               const number = trimmed.split('.')[0];
               const content = trimmed.substring(trimmed.indexOf('.') + 1).trim();
               elements.push(
                 <div key={i} className="flex gap-3 mb-2 text-gray-300 bg-gray-800/30 p-2 rounded">
                    <span className="font-bold text-blue-400 bg-blue-900/20 px-2 rounded h-fit">{number}.</span>
                    <span className="leading-relaxed">{content}</span>
                 </div>
               );
          } 
          // Regular paragraph
          else {
               elements.push(<p key={i} className="mb-2 text-gray-300 leading-relaxed">{trimmed}</p>);
          }
      }
    }
  });

  // Flush trailing table if exists
  if (inTable) elements.push(flushTable(lines.length));

  return <div className="space-y-1">{elements}</div>;
};

const ProfileView: React.FC<ProfileViewProps> = ({ profile, onUpdateProfile }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [editForm, setEditForm] = useState<CompanyProfile>(profile);
  const [customTypeInput, setCustomTypeInput] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleFinancialMetricChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
        ...prev,
        financialMetrics: {
            ...prev.financialMetrics,
            [name]: value
        } as any
    }));
  };

  const handleFinancingTypeChange = (option: string) => {
    setEditForm(prev => {
      const currentTypes = prev.financingType;
      if (currentTypes.includes(option)) {
        return { ...prev, financingType: currentTypes.filter(t => t !== option) };
      } else {
        return { ...prev, financingType: [...currentTypes, option] };
      }
    });
  };

  const handleAddCustomType = () => {
    if (customTypeInput.trim() && !editForm.financingType.includes(customTypeInput.trim())) {
      setEditForm(prev => ({
        ...prev,
        financingType: [...prev.financingType, customTypeInput.trim()]
      }));
      setCustomTypeInput('');
    }
  };

  const handleRemoveCustomType = (typeToRemove: string) => {
    setEditForm(prev => ({
      ...prev,
      financingType: prev.financingType.filter(t => t !== typeToRemove)
    }));
  };

  const handleOdsChange = (ods: string) => {
    setEditForm(prev => {
      const currentOds = prev.selectedOds;
      if (currentOds.includes(ods)) {
        return { ...prev, selectedOds: currentOds.filter(o => o !== ods) };
      } else {
        return { ...prev, selectedOds: [...currentOds, ods] };
      }
    });
  };

  const handleFileChange = (fieldPrefix: 'brief' | 'financials', file: File | undefined) => {
    if (!file) return;

    if (fieldPrefix === 'brief') {
      if (file.type !== 'application/pdf') {
        alert("El Brief / Resumen Ejecutivo debe ser un archivo PDF.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64String = e.target?.result as string;
        setEditForm(prev => ({
          ...prev,
          hasBrief: true,
          briefFileName: file.name,
          briefMimeType: file.type,
          briefFileBase64: base64String
        }));
      };
      reader.readAsDataURL(file);
    } else {
      // Financials logic
      const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                      file.type === 'application/vnd.ms-excel' ||
                      file.name.endsWith('.xlsx') || 
                      file.name.endsWith('.xls');

      if (isExcel) {
          if (typeof window.XLSX === 'undefined') {
              alert("Librería de Excel no cargada. Por favor intente recargar la página.");
              return;
          }
          const reader = new FileReader();
          reader.onload = (e) => {
              try {
                  const data = new Uint8Array(e.target?.result as ArrayBuffer);
                  const workbook = window.XLSX.read(data, { type: 'array' });
                  const firstSheet = workbook.SheetNames[0];
                  const worksheet = workbook.Sheets[firstSheet];
                  const csvOutput = window.XLSX.utils.sheet_to_csv(worksheet);
                  
                  const base64CSV = btoa(unescape(encodeURIComponent(csvOutput)));
                  
                  setEditForm(prev => ({
                    ...prev,
                    hasFinancials: true,
                    financialsFileName: file.name,
                    financialsMimeType: 'text/csv',
                    financialsFileBase64: `data:text/csv;base64,${base64CSV}`
                  }));
              } catch (err) {
                  console.error("Error parsing Excel:", err);
                  alert("Error al leer el archivo Excel.");
              }
          };
          reader.readAsArrayBuffer(file);
      } else {
          const reader = new FileReader();
          reader.onload = (e) => {
            const base64String = e.target?.result as string;
            setEditForm(prev => ({
              ...prev,
              hasFinancials: true,
              financialsFileName: file.name,
              financialsMimeType: file.type || 'text/plain',
              financialsFileBase64: base64String
            }));
          };
          reader.readAsDataURL(file);
      }
    }
  };

  const saveChanges = async () => {
    // Check if files changed
    const briefChanged = editForm.briefFileName !== profile.briefFileName || editForm.briefFileBase64 !== profile.briefFileBase64;
    const financialsChanged = editForm.financialsFileName !== profile.financialsFileName || editForm.financialsFileBase64 !== profile.financialsFileBase64;

    // If no files changed, just save textual edits immediately
    if (!briefChanged && !financialsChanged) {
        onUpdateProfile(editForm);
        setIsEditing(false);
        return;
    }

    // If files changed, trigger AI regeneration using the NEW form data
    setIsRegenerating(true);
    try {
        let updatedProfile = { ...editForm };
        const extractionPromises = [];

        // 1. Re-extract brief data if changed (using the NEW base64 from editForm)
        if (briefChanged && updatedProfile.briefFileBase64 && updatedProfile.briefMimeType) {
             extractionPromises.push(
                 extractDataFromBrief(updatedProfile.briefFileBase64, updatedProfile.briefMimeType)
                 .then(data => ({ type: 'brief', data }))
             );
        }

        // 2. Re-extract financial metrics if changed (using the NEW base64 from editForm)
        if (financialsChanged && updatedProfile.financialsFileBase64 && updatedProfile.financialsMimeType) {
             extractionPromises.push(
                 extractFinancialMetrics(updatedProfile.financialsFileBase64, updatedProfile.financialsMimeType)
                 .then(data => ({ type: 'financial', data }))
             );
        }

        const results = await Promise.all(extractionPromises);

        // Apply extraction results
        results.forEach(res => {
            if (res.type === 'brief') {
                const p = res.data as Partial<CompanyProfile>;
                updatedProfile = { 
                    ...updatedProfile, 
                    ...p, 
                    // Preserve critical IDs or names if AI returns empty
                    companyName: p.companyName || updatedProfile.companyName 
                };
            }
            if (res.type === 'financial') {
                updatedProfile.financialMetrics = res.data;
            }
        });

        // 3. Regenerate Summary (Pass the UPDATED profile which has the NEW base64 files)
        const newSummary = await generateCompanyProfileSummary(updatedProfile);
        updatedProfile.aiGeneratedSummary = newSummary;

        onUpdateProfile(updatedProfile);
        setIsEditing(false);
    } catch (e) {
        console.error("Error regenerating profile:", e);
        alert("Hubo un error al procesar los documentos y regenerar el perfil.");
    } finally {
        setIsRegenerating(false);
    }
  };

  const cancelChanges = () => {
    setEditForm(profile);
    setIsEditing(false);
  };

  // Helper to parse the 2-part summary
  const getSummaryParts = (summary: string | undefined) => {
    if (!summary) return { general: "", financial: "" };
    
    // Check if headers exist
    const generalHeader = "## GENERALIDADES DE LA EMPRESA";
    const financialHeader = "## ESTADO FINANCIERO";

    if (summary.includes(generalHeader) && summary.includes(financialHeader)) {
        const parts = summary.split(financialHeader);
        const generalPart = parts[0].replace(generalHeader, "").trim();
        const financialPart = parts[1].trim();
        return { general: generalPart, financial: financialPart };
    }
    
    // Fallback for legacy summaries
    return { general: summary, financial: "" };
  };

  const { general, financial } = getSummaryParts(editForm.aiGeneratedSummary);

  if (isRegenerating) {
    return (
        <div className="min-h-[600px] flex flex-col items-center justify-center animate-fade-in">
            <div className="bg-gray-800/80 p-8 rounded-2xl border border-gray-700 shadow-2xl backdrop-blur-sm max-w-md w-full flex flex-col items-center text-center">
                <SpinnerIcon className="w-12 h-12 text-blue-400 animate-spin mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Regenerando Perfil</h3>
                <p className="text-gray-400 text-sm">
                    Analizando los nuevos documentos sustitutivos y actualizando el resumen financiero con Inteligencia Artificial...
                </p>
            </div>
        </div>
    );
  }

  return (
    <div className="w-full mt-8 animate-fade-in max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-gray-100 border-l-4 border-green-500 pl-4">
          Perfil Corporativo
        </h2>
        <div className="flex gap-3">
            {isEditing ? (
                <>
                    <button onClick={cancelChanges} className="text-sm px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300">
                        Cancelar
                    </button>
                    <button onClick={saveChanges} className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-semibold flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        Guardar y Regenerar
                    </button>
                </>
            ) : (
                <>
                    <span className="hidden sm:inline-block text-xs font-semibold bg-green-900/40 text-green-300 border border-green-800 px-3 py-1 rounded-full uppercase tracking-wider self-center">
                        Verificado por IA
                    </span>
                    <button onClick={() => setIsEditing(true)} className="text-sm px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded text-blue-300 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Editar
                    </button>
                </>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Info Card */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-bl-full -mr-8 -mt-8 pointer-events-none"></div>
            
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
              <div className="w-full">
                {isEditing ? (
                    <div className="space-y-3 mb-4">
                        <input
                            type="text"
                            name="companyName"
                            value={editForm.companyName}
                            onChange={handleInputChange}
                            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-xl font-bold text-white"
                            placeholder="Nombre de la empresa"
                        />
                        <div className="flex gap-2">
                            <input
                                type="text"
                                name="address"
                                value={editForm.address}
                                onChange={handleInputChange}
                                className="w-1/2 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-gray-300"
                                placeholder="Dirección"
                            />
                            <input
                                type="text"
                                name="companyType"
                                value={editForm.companyType}
                                onChange={handleInputChange}
                                className="w-1/2 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-gray-300"
                                placeholder="Tipo Legal"
                            />
                        </div>
                    </div>
                ) : (
                    <>
                        <h1 className="text-3xl font-bold text-white mb-2">{profile.companyName}</h1>
                        <div className="flex items-center gap-3 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                            {profile.address}
                        </span>
                        <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                        <span className="uppercase">{profile.companyType}</span>
                        </div>
                    </>
                )}
              </div>
              
              <div className="bg-gray-900 px-4 py-2 rounded-lg border border-gray-700 text-center min-w-[120px]">
                <span className="block text-xs text-gray-500 uppercase">Estado</span>
                {isEditing ? (
                    <input
                        type="text"
                        name="status"
                        value={editForm.status}
                        onChange={handleInputChange}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-center text-sm font-semibold text-blue-300 mt-1"
                    />
                ) : (
                    <span className="font-semibold text-blue-300">{profile.status}</span>
                )}
              </div>
            </div>

            {/* AI Summary Section - SPLIT VIEW */}
            <div className="mb-6 space-y-6">
                
                {/* Generalidades */}
                <div>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        GENERALIDADES DE LA EMPRESA
                    </h3>
                    <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700/50 text-gray-300 leading-relaxed text-sm sm:text-base">
                        {isEditing ? (
                            <textarea
                                name="aiGeneratedSummary"
                                value={editForm.aiGeneratedSummary}
                                onChange={handleInputChange}
                                className="w-full h-40 bg-gray-800 border border-gray-600 rounded p-2 text-sm text-gray-200"
                                placeholder="Edite el resumen completo aquí..."
                            />
                        ) : (
                            <p>{general || "Información no disponible."}</p>
                        )}
                    </div>
                </div>

                {/* Estado Financiero (Only show if not editing or if structure exists) */}
                {(!isEditing && financial) && (
                    <div>
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            ESTADO FINANCIERO
                        </h3>
                        <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700/50 text-gray-300 border-l-4 border-l-green-600">
                            {/* NEW: Render table mode instead of raw pre */}
                            {renderFormattedContent(financial)}
                        </div>
                    </div>
                )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Necesidades de Financiamiento</h3>
              {isEditing ? (
                  <div className="bg-gray-900/50 p-4 rounded border border-gray-700/50">
                      {/* Standard Options */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                        {financingOptions.map(option => (
                            <label key={option} className="flex items-center space-x-2 cursor-pointer p-1 hover:bg-gray-800 rounded transition-colors">
                                <input
                                    type="checkbox"
                                    checked={editForm.financingType.includes(option)}
                                    onChange={() => handleFinancingTypeChange(option)}
                                    className="form-checkbox h-4 w-4 text-blue-500 rounded border-gray-600 bg-gray-800"
                                />
                                <span className={`text-sm ${editForm.financingType.includes(option) ? 'text-blue-300' : 'text-gray-300'}`}>{option}</span>
                            </label>
                        ))}
                      </div>

                      {/* Custom Types Tags */}
                      {editForm.financingType.some(t => !financingOptions.includes(t)) && (
                        <div className="border-t border-gray-700 pt-3 mb-3">
                            <span className="block text-xs text-gray-400 mb-2">Personalizados:</span>
                            <div className="flex flex-wrap gap-2">
                                {editForm.financingType.filter(t => !financingOptions.includes(t)).map(customType => (
                                    <span key={customType} className="inline-flex items-center px-2 py-1 rounded bg-blue-900/30 text-blue-200 border border-blue-800 text-xs">
                                        {customType}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveCustomType(customType)}
                                            className="ml-2 hover:text-red-400 focus:outline-none"
                                            title="Remover"
                                        >
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                      )}

                      {/* Add Custom Input */}
                      <div className="flex gap-2">
                            <input
                                type="text"
                                value={customTypeInput}
                                onChange={(e) => setCustomTypeInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomType())}
                                className="flex-grow bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 focus:border-blue-500 outline-none"
                                placeholder="Agregar otro tipo..."
                            />
                            <button
                                type="button"
                                onClick={handleAddCustomType}
                                className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm px-3 py-1 rounded border border-gray-600"
                            >
                                +
                            </button>
                      </div>
                  </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                    {profile.financingType.map((type) => (
                    <span key={type} className="px-3 py-1 bg-blue-900/30 text-blue-200 border border-blue-800 rounded-md text-sm font-medium">
                        {type}
                    </span>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          {/* Financials Card */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-lg">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Datos Clave</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-gray-700/50">
                <span className="text-gray-400 text-sm">Constitución</span>
                {isEditing ? (
                    <input 
                        type="date" 
                        name="incorporationDate"
                        value={editForm.incorporationDate}
                        onChange={handleInputChange}
                        className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200"
                    />
                ) : (
                    <span className="text-gray-200 font-medium">{profile.incorporationDate}</span>
                )}
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-gray-700/50">
                <span className="text-gray-400 text-sm">Capital Requerido</span>
                {isEditing ? (
                    <input 
                        type="number" 
                        name="amountRequired"
                        value={editForm.amountRequired}
                        onChange={handleInputChange}
                        className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-green-400 font-bold w-24"
                    />
                ) : (
                    <span className="text-green-400 font-bold text-lg">${Number(profile.amountRequired).toLocaleString()}</span>
                )}
              </div>
            </div>
            
            {/* Financial Metrics Section */}
            <div className="mt-6 pt-4 border-t border-gray-700/50">
                <h4 className="text-xs font-semibold text-blue-300 uppercase tracking-wide mb-3">KPIs Detectados</h4>
                <div className="space-y-2">
                    <div className="flex justify-between text-sm items-center">
                        <span className="text-gray-400">VAN</span>
                        {isEditing ? (
                            <input type="text" name="van" value={editForm.financialMetrics?.van} onChange={handleFinancialMetricChange} className="w-20 bg-gray-900 border border-gray-600 rounded text-xs px-1" />
                        ) : (
                            <span className="text-gray-200 font-mono">{profile.financialMetrics?.van || 'N/A'}</span>
                        )}
                    </div>
                    <div className="flex justify-between text-sm items-center">
                        <span className="text-gray-400">TIR</span>
                        {isEditing ? (
                            <input type="text" name="tir" value={editForm.financialMetrics?.tir} onChange={handleFinancialMetricChange} className="w-20 bg-gray-900 border border-gray-600 rounded text-xs px-1" />
                        ) : (
                            <span className="text-gray-200 font-mono">{profile.financialMetrics?.tir || 'N/A'}</span>
                        )}
                    </div>
                    <div className="flex justify-between text-sm items-center">
                        <span className="text-gray-400">EBITDA</span>
                        {isEditing ? (
                            <input type="text" name="ebitda" value={editForm.financialMetrics?.ebitda} onChange={handleFinancialMetricChange} className="w-20 bg-gray-900 border border-gray-600 rounded text-xs px-1" />
                        ) : (
                            <span className="text-gray-200 font-mono">{profile.financialMetrics?.ebitda || 'N/A'}</span>
                        )}
                    </div>
                </div>
            </div>
          </div>

          {/* Documents & ODS Card */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-lg">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Soporte & Impacto</h3>
            <div className="space-y-3">
              {/* Files */}
              <div className={`flex flex-col p-3 rounded-lg border ${editForm.briefFileName ? 'bg-green-900/10 border-green-900/30' : 'bg-gray-900/30 border-gray-700'}`}>
                <div className="flex items-center">
                    <div className={`p-2 rounded-full mr-3 ${editForm.briefFileName ? 'bg-green-900/30 text-green-400' : 'bg-gray-700 text-gray-500'}`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <div className="overflow-hidden flex-1">
                    <p className="text-xs font-semibold text-gray-300">Brief Ejecutivo</p>
                    <p className="text-xs text-gray-500 truncate">{editForm.briefFileName || "Pendiente"}</p>
                    </div>
                </div>
                {isEditing && (
                    <div className="mt-2 w-full">
                         <label className="flex items-center justify-center w-full px-2 py-1 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded cursor-pointer text-xs text-blue-300 transition-colors">
                            <span>Subir Nuevo (Sustituir)</span>
                            <input 
                                type="file" 
                                className="hidden" 
                                accept="application/pdf"
                                onChange={(e) => handleFileChange('brief', e.target.files?.[0])}
                            />
                        </label>
                    </div>
                )}
              </div>

              <div className={`flex flex-col p-3 rounded-lg border ${editForm.financialsFileName ? 'bg-green-900/10 border-green-900/30' : 'bg-gray-900/30 border-gray-700'}`}>
                <div className="flex items-center">
                    <div className={`p-2 rounded-full mr-3 ${editForm.financialsFileName ? 'bg-green-900/30 text-green-400' : 'bg-gray-700 text-gray-500'}`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div className="overflow-hidden flex-1">
                        <p className="text-xs font-semibold text-gray-300">Financieros</p>
                        <p className="text-xs text-gray-500 truncate">{editForm.financialsFileName || "Pendiente"}</p>
                    </div>
                </div>
                {isEditing && (
                    <div className="mt-2 w-full">
                         <label className="flex items-center justify-center w-full px-2 py-1 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded cursor-pointer text-xs text-blue-300 transition-colors">
                            <span>Subir Nuevo (Sustituir)</span>
                            <input 
                                type="file" 
                                className="hidden" 
                                accept=".pdf, .csv, .txt, .json, .xls, .xlsx"
                                onChange={(e) => handleFileChange('financials', e.target.files?.[0])}
                            />
                        </label>
                    </div>
                )}
              </div>
              
              {/* ODS List Section */}
              <div className="pt-2">
                 <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">ODS Enfocados</p>
                 
                 {isEditing ? (
                     <div className="max-h-48 overflow-y-auto bg-gray-900/50 p-2 rounded border border-gray-700 custom-scrollbar">
                         {odsList.map(ods => {
                             const isSelected = editForm.selectedOds.some(selected => {
                                if (selected === ods) return true;
                                const selectedNum = selected.split('.')[0].trim();
                                const odsNum = ods.split('.')[0].trim();
                                return selectedNum === odsNum;
                            });
                             return (
                                <button
                                    key={ods}
                                    onClick={() => handleOdsChange(ods)}
                                    className={`text-left w-full text-xs px-2 py-1 mb-1 rounded flex items-center ${
                                        isSelected ? 'bg-blue-900/40 text-blue-200' : 'text-gray-400 hover:bg-gray-800'
                                    }`}
                                >
                                    <div className={`w-1.5 h-1.5 rounded-full mr-2 ${isSelected ? 'bg-blue-400' : 'bg-gray-600'}`}></div>
                                    {ods}
                                </button>
                             )
                         })}
                     </div>
                 ) : (
                    <div className="flex flex-wrap gap-2">
                        {profile.selectedOds.length > 0 ? (
                            profile.selectedOds.map(ods => (
                            <span key={ods} className="inline-block px-2 py-1 bg-gray-900 border border-gray-600 rounded text-[10px] text-gray-300">
                                {ods.split('.')[0]}
                            </span>
                            ))
                        ) : (
                            <span className="text-xs text-gray-500 italic">No seleccionados</span>
                        )}
                    </div>
                 )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;

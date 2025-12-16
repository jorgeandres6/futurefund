
import React, { useState } from 'react';
import { CompanyProfile } from '../types';
import SpinnerIcon from './icons/SpinnerIcon';
import { extractDataFromBrief, extractFinancialMetrics } from '../services/geminiService';

interface OnboardingFormProps {
  onSubmit: (profile: CompanyProfile) => void;
  userName: string;
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

const OnboardingForm: React.FC<OnboardingFormProps> = ({ onSubmit, userName }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState<CompanyProfile>({
    companyName: '',
    address: '',
    companyType: '',
    status: '',
    financingType: [], 
    incorporationDate: '',
    amountRequired: '',
    hasBrief: false,
    hasFinancials: false,
    selectedOds: [],
    briefFileName: '',
    financialsFileName: '',
    briefFileBase64: '',
    briefMimeType: '',
    financialsFileBase64: '',
    financialsMimeType: '',
    financialMetrics: {
        van: '',
        tir: '',
        ebitda: ''
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [customTypeInput, setCustomTypeInput] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFinancingTypeChange = (option: string) => {
    setFormData(prev => {
      const currentTypes = prev.financingType;
      if (currentTypes.includes(option)) {
        return { ...prev, financingType: currentTypes.filter(t => t !== option) };
      } else {
        return { ...prev, financingType: [...currentTypes, option] };
      }
    });
  };

  const handleAddCustomType = () => {
    if (customTypeInput.trim() && !formData.financingType.includes(customTypeInput.trim())) {
      setFormData(prev => ({
        ...prev,
        financingType: [...prev.financingType, customTypeInput.trim()]
      }));
      setCustomTypeInput('');
    }
  };

  const handleRemoveCustomType = (typeToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      financingType: prev.financingType.filter(t => t !== typeToRemove)
    }));
  };

  const handleOdsChange = (ods: string) => {
    setFormData(prev => {
      const currentOds = prev.selectedOds;
      // We use exact string matching here because the UI options are from odsList
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
        setFormData(prev => ({
          ...prev,
          hasBrief: true,
          briefFileName: file.name,
          briefMimeType: file.type,
          briefFileBase64: base64String
        }));
      };
      reader.readAsDataURL(file);
    } else {
      // Financials logic: handle Excel specifically
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
                  
                  // Encode CSV to Base64 to match expected state format (preserving UTF-8)
                  const base64CSV = btoa(unescape(encodeURIComponent(csvOutput)));
                  
                  setFormData(prev => ({
                    ...prev,
                    hasFinancials: true,
                    financialsFileName: file.name,
                    financialsMimeType: 'text/csv', // Spoof as CSV for the service
                    financialsFileBase64: `data:text/csv;base64,${base64CSV}`
                  }));
              } catch (err) {
                  console.error("Error parsing Excel:", err);
                  alert("Error al leer el archivo Excel. Asegúrese de que no esté protegido.");
              }
          };
          reader.readAsArrayBuffer(file);
      } else {
          // Allow PDF, CSV, TXT
          const reader = new FileReader();
          reader.onload = (e) => {
            const base64String = e.target?.result as string;
            setFormData(prev => ({
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

  const handleNextStep = async () => {
    // Only extract if at least one file is present
    if ((formData.hasBrief && formData.briefFileBase64) || (formData.hasFinancials && formData.financialsFileBase64)) {
        setIsExtracting(true);
        try {
            const promises = [];

            // 1. Brief Extraction
            if (formData.hasBrief && formData.briefFileBase64 && formData.briefMimeType) {
                promises.push(extractDataFromBrief(formData.briefFileBase64, formData.briefMimeType));
            } else {
                promises.push(Promise.resolve({}));
            }

            // 2. Financials Extraction
            if (formData.hasFinancials && formData.financialsFileBase64 && formData.financialsMimeType) {
                promises.push(extractFinancialMetrics(formData.financialsFileBase64, formData.financialsMimeType));
            } else {
                promises.push(Promise.resolve(null));
            }

            const [briefData, financialData] = await Promise.all(promises);
            const extractedProfile = briefData as Partial<CompanyProfile>;
            const extractedMetrics = financialData as any;

            // Normalize Extracted ODS
            let uniqueOds = formData.selectedOds;
            if (extractedProfile.selectedOds) {
                const normalizedOds = extractedProfile.selectedOds.reduce<string[]>((acc, extracted) => {
                    const match = extracted.match(/^(\d+)/);
                    if (match) {
                        const num = match[1];
                        const official = odsList.find(o => o.startsWith(`${num}.`));
                        if (official) {
                            acc.push(official);
                            return acc;
                        }
                    }
                    const textMatch = odsList.find(o => o.toLowerCase().includes(extracted.toLowerCase()));
                    if (textMatch) acc.push(textMatch);
                    return acc;
                }, []);
                uniqueOds = Array.from(new Set([...formData.selectedOds, ...normalizedOds]));
            }

            // Merge Financing Types (Pre-selected/Custom + Extracted)
            let uniqueFinancing = formData.financingType;
            if (extractedProfile.financingType && extractedProfile.financingType.length > 0) {
                uniqueFinancing = Array.from(new Set([...formData.financingType, ...extractedProfile.financingType]));
            }

            setFormData(prev => ({
                ...prev,
                ...extractedProfile,
                selectedOds: uniqueOds.length > 0 ? uniqueOds : prev.selectedOds,
                financingType: uniqueFinancing.length > 0 ? uniqueFinancing : prev.financingType,
                financialMetrics: extractedMetrics ? {
                    van: extractedMetrics.van !== 'No identificado' ? extractedMetrics.van : prev.financialMetrics?.van,
                    tir: extractedMetrics.tir !== 'No identificado' ? extractedMetrics.tir : prev.financialMetrics?.tir,
                    ebitda: extractedMetrics.ebitda !== 'No identificado' ? extractedMetrics.ebitda : prev.financialMetrics?.ebitda,
                } : prev.financialMetrics
            }));

        } catch (error) {
            console.error("Failed to extract data", error);
        } finally {
            setIsExtracting(false);
            setStep(2);
        }
    } else {
        if (!formData.hasBrief && !formData.hasFinancials) {
             if(!confirm("No has adjuntado documentos. ¿Deseas continuar?")) {
                return;
             }
        }
        setStep(2);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.financingType.length === 0) {
        alert("Por favor seleccione al menos un tipo de financiamiento.");
        return;
    }

    if (formData.selectedOds.length === 0) {
      alert("Por favor seleccione al menos un Objetivo de Desarrollo Sostenible (ODS).");
      return;
    }

    setIsLoading(true);
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 800));
    setIsLoading(false);
    onSubmit(formData);
  };

  // Helper component for file input
  const FileUploadField = ({ 
    label, 
    prefix, 
    fileName,
    description,
    accept = "*",
    downloadTemplateUrl,
    infoTooltip
  }: { 
    label: string, 
    prefix: 'brief' | 'financials', 
    fileName?: string,
    description?: string,
    accept?: string,
    downloadTemplateUrl?: string,
    infoTooltip?: string
  }) => (
    <div className="flex flex-col p-6 bg-gray-800 rounded-xl border border-gray-700 hover:border-gray-600 transition-all duration-300 shadow-lg">
      <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col items-start w-full">
            <div className="flex items-center gap-2">
                <span className="text-lg text-gray-200 font-semibold block">{label}</span>
                {infoTooltip && (
                    <div className="relative group cursor-help">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-blue-400 hover:text-blue-300 transition-colors">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                        </svg>
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-56 p-2 bg-black/95 text-gray-200 text-xs rounded-lg shadow-xl border border-gray-700 z-50 text-center pointer-events-none">
                            {infoTooltip}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/95"></div>
                        </div>
                    </div>
                )}
            </div>
            {description && <span className="text-sm text-gray-400 mt-1 block">{description}</span>}
            {downloadTemplateUrl && (
                <a 
                    href={downloadTemplateUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-400 bg-blue-900/20 hover:bg-blue-900/40 border border-blue-900/50 hover:border-blue-700 rounded px-2 py-1 transition-all"
                    title="Descargar formato sugerido"
                >
                     <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                     </svg>
                    Descargar Plantilla / Formato
                </a>
            )}
          </div>
          {fileName && (
            <div className="bg-green-900/30 border border-green-800 p-1.5 rounded-full ml-2">
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
            </div>
          )}
      </div>
      
      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-700/30 hover:bg-gray-700/50 transition-colors group">
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <svg className={`w-8 h-8 mb-3 ${fileName ? 'text-green-500' : 'text-gray-400 group-hover:text-blue-400'}`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.017 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
          </svg>
          <p className="mb-2 text-sm text-gray-400 group-hover:text-gray-300">
            <span className="font-semibold">{fileName ? 'Archivo cargado' : 'Click para subir'}</span> o arrastrar
          </p>
          <p className="text-xs text-gray-500">{prefix === 'brief' ? 'PDF (MAX. 10MB)' : 'PDF, Excel, CSV, TXT'}</p>
        </div>
        <input 
          type="file" 
          className="hidden" 
          onChange={(e) => handleFileChange(prefix, e.target.files?.[0])}
          accept={accept}
        />
      </label>
      
      {fileName && (
         <div className="mt-4 text-sm text-green-400 flex items-center bg-green-900/10 px-3 py-2 rounded border border-green-900/30 w-full">
            <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
            <span className="truncate font-medium">{fileName}</span>
         </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-gray-900 p-4 animate-fade-in">
      <div className="w-full max-w-3xl bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden relative">
        {/* Header Gradient */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-green-500"></div>

        <div className="p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-100 mb-2">
                {step === 1 ? 'Carga de Documentación' : 'Perfil de la Empresa'}
            </h2>
            <p className="text-gray-400 text-sm">
              Hola <span className="text-blue-400">{userName}</span>, configura tu perfil en 2 pasos sencillos.
            </p>
            
            {/* Progress Bar */}
            <div className="flex items-center justify-center mt-6 mb-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 1 ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'}`}>1</div>
                <div className={`w-16 h-1 mx-2 ${step === 2 ? 'bg-green-600' : 'bg-gray-700'}`}></div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 2 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}>2</div>
            </div>
            <div className="flex justify-center text-xs text-gray-500 gap-16">
                <span>Archivos</span>
                <span>Detalles</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* PHASE 1: DOCUMENT UPLOAD */}
            {step === 1 && (
                <div className="animate-fade-in">
                     <div className="bg-blue-900/20 p-4 rounded-lg text-sm text-blue-200 border border-blue-800/30 mb-6 flex items-start gap-3">
                        <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <p>
                            Para generar un perfil preciso, sube tu <strong>Brief Ejecutivo</strong> primero. Nuestra IA analizará este documento para entender tu modelo de negocio y conectarte con los mejores fondos.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <FileUploadField 
                        label="Brief / Resumen Ejecutivo" 
                        prefix="brief" 
                        fileName={formData.briefFileName} 
                        description="Documento principal que describe tu empresa, problema y solución. (Solo PDF)"
                        accept="application/pdf"
                        />
                        <FileUploadField 
                        label="Datos Financieros" 
                        prefix="financials" 
                        fileName={formData.financialsFileName}
                        description="Reporte para extracción de VAN, TIR y EBITDA. (PDF, Excel, CSV, TXT)"
                        accept=".pdf, .csv, .txt, .json, .xls, .xlsx"
                        downloadTemplateUrl="https://1drv.ms/f/c/3c87de2ee132404b/Eq-13PddkUZPqQ0gy691X4UByq9q5_k_ImjToTZIzcGkcA?e=GFvYHC"
                        infoTooltip="Descarga y llena la plantilla de Datos Financieros antes de cargarla. Esto asegura que nuestro sistema pueda leer correctamente tus indicadores (VAN, TIR, EBITDA)."
                        />
                    </div>

                    <button
                        type="button"
                        onClick={handleNextStep}
                        disabled={isExtracting}
                        className="w-full mt-8 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform transition-all duration-200 hover:-translate-y-0.5 flex justify-center items-center group disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isExtracting ? (
                             <>
                                <SpinnerIcon className="w-5 h-5 mr-3 animate-spin text-blue-400" />
                                Analizando documentos con IA...
                             </>
                        ) : (
                            <>
                                Siguiente Paso
                                <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* PHASE 2: FORM DATA */}
            {step === 2 && (
                <div className="animate-fade-in space-y-6">
                     <div className="mb-4 flex items-center bg-green-900/20 border border-green-800 p-3 rounded-lg">
                        <svg className="w-5 h-5 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span className="text-sm text-gray-300">
                             {formData.briefFileName || formData.financialsFileName
                                ? "Datos extraídos automáticamente. Por favor, revisa y completa la información." 
                                : "Por favor completa la información de tu perfil."}
                        </span>
                     </div>

                     {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Nombre de la empresa</label>
                        <input
                        type="text"
                        name="companyName"
                        required
                        value={formData.companyName}
                        onChange={handleChange}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors"
                        placeholder="Ej. EcoSolutions S.A."
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Dirección</label>
                        <input
                        type="text"
                        name="address"
                        required
                        value={formData.address}
                        onChange={handleChange}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors"
                        placeholder="Ciudad, País"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Tipo Legal</label>
                        <input
                        type="text"
                        name="companyType"
                        required
                        value={formData.companyType}
                        onChange={handleChange}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors"
                        placeholder="Ej. S.A., Cia. Ltda., SAS, ONG"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Estado / Etapa</label>
                        <input
                        type="text"
                        name="status"
                        required
                        value={formData.status}
                        onChange={handleChange}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors"
                        placeholder="Ej. Semilla, Crecimiento, Escalamiento"
                        />
                    </div>
                    </div>

                    <hr className="border-gray-700/50" />

                    {/* Financing Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                        Tipo de financiamiento requerido (Selección Múltiple)
                        </label>
                        <div className="bg-gray-900/30 p-4 rounded-lg border border-gray-700/30 space-y-4">
                            {/* Standard Options */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {financingOptions.map(option => (
                                    <label key={option} className="flex items-center space-x-3 cursor-pointer group p-1 hover:bg-gray-800/50 rounded transition-colors">
                                    <div className="relative flex items-center">
                                        <input
                                        type="checkbox"
                                        checked={formData.financingType.includes(option)}
                                        onChange={() => handleFinancingTypeChange(option)}
                                        className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-gray-600 bg-gray-800 transition-all checked:border-blue-500 checked:bg-blue-500 hover:border-blue-400"
                                        />
                                        <svg className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" width="12" height="12"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    </div>
                                    <span className={`text-sm transition-colors ${formData.financingType.includes(option) ? 'text-blue-300 font-medium' : 'text-gray-300 group-hover:text-blue-200'}`}>
                                        {option}
                                    </span>
                                    </label>
                                ))}
                            </div>

                            {/* Custom Options Display */}
                            {formData.financingType.some(t => !financingOptions.includes(t)) && (
                                <div className="border-t border-gray-700/50 pt-3">
                                    <label className="block text-xs text-gray-400 mb-2">Otros tipos seleccionados / detectados:</label>
                                    <div className="flex flex-wrap gap-2">
                                        {formData.financingType.filter(t => !financingOptions.includes(t)).map(customType => (
                                            <span key={customType} className="inline-flex items-center px-2 py-1 rounded bg-blue-900/30 text-blue-200 border border-blue-800 text-sm">
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
                            <div className="border-t border-gray-700/50 pt-3 flex flex-col sm:flex-row gap-2 items-end sm:items-center">
                                <div className="flex-grow w-full">
                                    <label className="block text-xs text-gray-500 mb-1">Agregar otro tipo (ej. Crowdfunding, Royalty):</label>
                                    <input
                                        type="text"
                                        value={customTypeInput}
                                        onChange={(e) => setCustomTypeInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomType())}
                                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500 outline-none"
                                        placeholder="Escribe y presiona Enter..."
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddCustomType}
                                    className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm px-4 py-1.5 rounded border border-gray-600 transition-colors h-fit sm:mt-5"
                                >
                                    Agregar
                                </button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Fecha de constitución</label>
                        <input
                        type="date"
                        name="incorporationDate"
                        required
                        value={formData.incorporationDate}
                        onChange={handleChange}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Monto Requerido (USD)</label>
                        <input
                        type="number"
                        name="amountRequired"
                        required
                        value={formData.amountRequired}
                        onChange={handleChange}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors"
                        placeholder="0.00"
                        />
                    </div>
                    </div>

                    <hr className="border-gray-700/50" />

                    {/* ODS Selection */}
                    <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                        Identificación de Impacto (Seleccione los ODS principales)
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 bg-gray-900/30 p-3 rounded-lg border border-gray-700/30 max-h-60 overflow-y-auto custom-scrollbar">
                        {odsList.map((ods) => {
                        // Strict Number Matching logic to avoid "1" matching "10"
                        const isSelected = formData.selectedOds.some(selected => {
                            if (selected === ods) return true;
                            // Check number part strict equality
                            const selectedNum = selected.split('.')[0].trim();
                            const odsNum = ods.split('.')[0].trim();
                            return selectedNum === odsNum;
                        });
                        
                        return (
                            <button
                            key={ods}
                            type="button"
                            onClick={() => handleOdsChange(ods)}
                            className={`
                                text-left text-xs px-3 py-2 rounded-md border transition-all duration-200 flex items-center
                                ${isSelected 
                                ? 'bg-blue-900/40 border-blue-500 text-blue-100 shadow-sm shadow-blue-900/20' 
                                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                                }
                            `}
                            >
                            <div className={`w-2 h-2 rounded-full mr-2 ${isSelected ? 'bg-blue-400' : 'bg-gray-600'}`}></div>
                            {ods}
                            </button>
                        );
                        })}
                    </div>
                    {formData.selectedOds.length > 0 && (
                        <p className="text-xs text-blue-400 mt-2 ml-1">
                        {formData.selectedOds.length} Objetivos seleccionados
                        </p>
                    )}
                    </div>

                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="w-1/3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 px-4 rounded-lg border border-gray-700 transition-colors"
                        >
                            Atrás
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-2/3 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform transition-all duration-200 hover:-translate-y-0.5 flex justify-center items-center"
                        >
                            {isLoading ? (
                                <SpinnerIcon className="w-5 h-5 animate-spin mr-2" />
                            ) : null}
                            Finalizar y Crear Perfil
                        </button>
                    </div>
                </div>
            )}
            
          </form>
        </div>
      </div>
    </div>
  );
};

export default OnboardingForm;

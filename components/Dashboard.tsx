
import React, { useMemo, useState } from 'react';
import { Fund } from '../types';
import FundDetailModal from './FundDetailModal';
import DownloadIcon from './icons/DownloadIcon';

interface DashboardProps {
  funds: Fund[];
  userId: string;
}

type SortColumn = 'nombre' | 'tipo' | 'gestor' | 'estado' | 'impacto' | 'ods' | 'fecha';
type SortDirection = 'asc' | 'desc';

const Dashboard: React.FC<DashboardProps> = ({ funds, userId }) => {
  const [selectedFund, setSelectedFund] = useState<Fund | null>(null);
  const [searchText, setSearchText] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn>('nombre');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedFundTypes, setSelectedFundTypes] = useState<string[]>([]);
  const [selectedSubfundByGroup, setSelectedSubfundByGroup] = useState<Record<string, number>>({});

  const getFundTypeValue = (fund: Fund): string => {
    const type = fund.ticker_isin?.trim();
    return type ? type : 'N/A';
  };

  const availableFundTypes = useMemo(() => {
    return Array.from(new Set(funds.map(getFundTypeValue))).sort((a, b) => a.localeCompare(b));
  }, [funds]);

  // Handle column sort
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Filter and sort funds
  const filteredAndSortedFunds = useMemo(() => {
    // First, filter by search text
    let result = funds.filter(fund => 
      fund.nombre_fondo.toLowerCase().includes(searchText.toLowerCase())
    );

    if (selectedFundTypes.length > 0) {
      result = result.filter((fund) => selectedFundTypes.includes(getFundTypeValue(fund)));
    }

    // Then, sort by selected column
    result.sort((a, b) => {
      let aValue: string | number = '';
      let bValue: string | number = '';

      switch (sortColumn) {
        case 'nombre':
          aValue = a.nombre_fondo.toLowerCase();
          bValue = b.nombre_fondo.toLowerCase();
          break;
        case 'tipo':
          aValue = getFundTypeValue(a).toLowerCase();
          bValue = getFundTypeValue(b).toLowerCase();
          break;
        case 'gestor':
          aValue = a.gestor_activos.toLowerCase();
          bValue = b.gestor_activos.toLowerCase();
          break;
        case 'estado':
          aValue = a.applicationStatus || '';
          bValue = b.applicationStatus || '';
          break;
        case 'impacto':
          aValue = a.alineacion_detectada.puntuacion_impacto.toLowerCase();
          bValue = b.alineacion_detectada.puntuacion_impacto.toLowerCase();
          break;
        case 'ods':
          aValue = a.alineacion_detectada.ods_encontrados.length;
          bValue = b.alineacion_detectada.ods_encontrados.length;
          break;
        case 'fecha':
          aValue = new Date(a.updated_at || a.fecha_scrapeo).getTime();
          bValue = new Date(b.updated_at || b.fecha_scrapeo).getTime();
          break;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [funds, searchText, selectedFundTypes, sortColumn, sortDirection]);

  const getMainDomain = (url: string, fallbackIndex: number): string => {
    if (!url) return `sin-dominio-${fallbackIndex}`;

    const normalizedInput = url.trim().toLowerCase();
    if (!normalizedInput) return `sin-dominio-${fallbackIndex}`;

    try {
      const urlWithProtocol = /^https?:\/\//.test(normalizedInput)
        ? normalizedInput
        : `https://${normalizedInput}`;

      const hostname = new URL(urlWithProtocol).hostname.replace(/^www\d*\./, '');
      const parts = hostname.split('.').filter(Boolean);

      if (parts.length <= 2) return hostname;

      const lastTwo = parts.slice(-2).join('.');
      const knownSecondLevelTlds = new Set([
        'co.uk', 'org.uk', 'gov.uk',
        'com.au', 'net.au', 'org.au',
        'com.br', 'com.mx', 'com.ar', 'com.co', 'com.pe', 'com.ec'
      ]);

      if (knownSecondLevelTlds.has(lastTwo) && parts.length >= 3) {
        return parts.slice(-3).join('.');
      }

      return lastTwo;
    } catch {
      return normalizedInput.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\d*\./, '') || `sin-dominio-${fallbackIndex}`;
    }
  };

  const groupedFunds = useMemo(() => {
    const groups: Array<{ key: string; url: string; funds: Fund[] }> = [];
    const groupIndexByKey = new Map<string, number>();

    filteredAndSortedFunds.forEach((fund, index) => {
      const groupKey = getMainDomain(fund.url_fuente, index);

      const existingGroupIndex = groupIndexByKey.get(groupKey);
      if (existingGroupIndex !== undefined) {
        groups[existingGroupIndex].funds.push(fund);
        return;
      }

      groupIndexByKey.set(groupKey, groups.length);
      groups.push({
        key: groupKey,
        url: fund.url_fuente,
        funds: [fund],
      });
    });

    return groups;
  }, [filteredAndSortedFunds]);

  // Export to CSV function
  const exportToCSV = () => {
    const header = [
      'Nombre del Fondo',
      'Fecha de Actualización',
      'Gestor de Activos',
      'Ticker/ISIN',
      'Estado',
      'Puntuación de Impacto',
      'ODS Encontrados',
      'URL Fuente',
      'Es Elegible',
      'Emails de Contacto',
      'Link de Aplicación',
      'Resumen de Requisitos',
      'Pasos de Aplicación',
      'Fechas Clave',
      'Historial'
    ].join(',');

    const rows = filteredAndSortedFunds.map(fund => {
      const values = [
        `"${fund.nombre_fondo.replace(/"/g, '""')}"`,
        `"${fund.updated_at ? new Date(fund.updated_at).toLocaleDateString('es-ES') : new Date(fund.fecha_scrapeo).toLocaleDateString('es-ES')}"`,
        `"${fund.gestor_activos.replace(/"/g, '""')}"`,
        `"${fund.ticker_isin}"`,
        `"${fund.applicationStatus || 'N/A'}"`,
        `"${fund.alineacion_detectada.puntuacion_impacto}"`,
        `"${fund.alineacion_detectada.ods_encontrados.join('; ')}"`,
        `"${fund.url_fuente}"`,
        `"${fund.analisis_aplicacion?.es_elegible || 'N/A'}"`,
        `"${fund.analisis_aplicacion?.contact_emails?.join('; ') || 'N/A'}"`,
        `"${fund.analisis_aplicacion?.link_directo_aplicacion || 'N/A'}"`,
        `"${fund.analisis_aplicacion?.resumen_requisitos?.join('; ') || 'N/A'}"`,
        `"${fund.analisis_aplicacion?.pasos_aplicacion?.join('; ') || 'N/A'}"`,
        `"${fund.analisis_aplicacion?.fechas_clave || 'N/A'}"`,
        `"${fund.history ? JSON.stringify(fund.history).replace(/"/g, '""') : 'N/A'}"`
      ];
      return values.join(',');
    });

    const csvContent = [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const exportFileName = `reporte_fondos_${new Date().toISOString().slice(0, 10)}.csv`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', url);
    linkElement.setAttribute('download', exportFileName);
    document.body.appendChild(linkElement);
    linkElement.click();
    document.body.removeChild(linkElement);
    URL.revokeObjectURL(url);
  };
  
  // Calculate statistics
  const stats = useMemo(() => {
    const totalFunds = funds.length;
    
    // Calculate High Impact funds (based on text analysis)
    const highImpactCount = funds.filter(f => 
      f.alineacion_detectada.puntuacion_impacto.toLowerCase().includes('alta') || 
      f.alineacion_detectada.puntuacion_impacto.toLowerCase().includes('muy alta')
    ).length;

    // Calculate most frequent ODS
    const odsFrequency: Record<string, number> = {};
    funds.forEach(fund => {
      fund.alineacion_detectada.ods_encontrados.forEach(ods => {
        // Simplify ODS string to just the number/short name if possible, or keep full
        const key = ods.split(':')[0].trim(); // e.g., "ODS 13"
        odsFrequency[key] = (odsFrequency[key] || 0) + 1;
      });
    });
    
    const sortedOds = Object.entries(odsFrequency).sort((a, b) => b[1] - a[1]);
    const topOds = sortedOds.length > 0 ? sortedOds[0][0] : 'N/A';

    return {
      totalFunds,
      highImpactCount,
      topOds
    };
  }, [funds]);

  if (funds.length === 0) {
    return null;
  }

  return (
    <div className="w-full mt-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold text-gray-100 border-l-4 border-blue-500 pl-4">
          Dashboard de Resultados
        </h2>
        <span className="text-sm text-gray-400 bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
          Última actualización: {new Date().toLocaleTimeString()}
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {/* Stat Card 1 */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 p-6 rounded-xl shadow-lg relative overflow-hidden group hover:border-blue-500/50 transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">Numero de fondos encontrados</p>
          <p className="text-4xl font-extrabold text-white mt-2">{stats.totalFunds}</p>
          <p className="text-xs text-blue-300 mt-2">Fuentes identificadas</p>
        </div>

        {/* Stat Card 2 */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 p-6 rounded-xl shadow-lg relative overflow-hidden group hover:border-green-500/50 transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 11.586 15.293 7.293A1 1 0 0115.586 7H12z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">Alto Impacto</p>
          <p className="text-4xl font-extrabold text-green-400 mt-2">{stats.highImpactCount}</p>
          <p className="text-xs text-green-300 mt-2">Alineación estratégica fuerte</p>
        </div>

        {/* Stat Card 3 */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 p-6 rounded-xl shadow-lg relative overflow-hidden group hover:border-purple-500/50 transition-all">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
               <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.497-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-5.568 0A6.004 6.004 0 014.083 11h1.946c.089 1.546.383 2.97.837 4.118z" clipRule="evenodd" />
             </svg>
           </div>
          <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">ODS Principal</p>
          <p className="text-3xl font-extrabold text-purple-400 mt-2 truncate">{stats.topOds}</p>
          <p className="text-xs text-purple-300 mt-2">Área de enfoque más común</p>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden shadow-lg">
        <div className="p-4 border-b border-gray-700 bg-gray-900/50">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-200">Resumen Ejecutivo de Fondos</h3>
            <div className="flex items-center gap-3">
              <div className="relative">
                <select
                  multiple
                  value={selectedFundTypes}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions, option => option.value);
                    setSelectedFundTypes(values);
                  }}
                  className="bg-gray-700 text-gray-200 border border-gray-600 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-56 h-24"
                  title="Filtrar por Tipo de Fondo"
                >
                  {availableFundTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={exportToCSV}
                className="flex items-center bg-green-900/30 border border-green-800 hover:bg-green-800/50 text-green-200 font-medium py-2 px-4 rounded-lg transition-colors duration-300 text-sm"
                title="Descargar reporte completo"
              >
                <DownloadIcon className="w-4 h-4 mr-2" />
                Descargar Reporte
              </button>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar fondo por nombre..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="bg-gray-700 text-gray-200 placeholder-gray-400 border border-gray-600 rounded-lg py-2 px-4 pl-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                />
                <svg 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 20 20" 
                  fill="currentColor"
                >
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[800px] overflow-y-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-900 text-gray-400 uppercase tracking-wider text-xs sticky top-0 z-10 shadow-md">
              <tr>
                <th 
                  scope="col" 
                  className="px-6 py-4 font-semibold cursor-pointer hover:bg-gray-800 transition-colors select-none"
                  onClick={() => handleSort('nombre')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Nombre del Fondo</span>
                    {sortColumn === 'nombre' && (
                      <svg className={`h-4 w-4 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-4 font-semibold cursor-pointer hover:bg-gray-800 transition-colors select-none"
                  onClick={() => handleSort('tipo')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Tipo de Fondo</span>
                    {sortColumn === 'tipo' && (
                      <svg className={`h-4 w-4 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-4 font-semibold cursor-pointer hover:bg-gray-800 transition-colors select-none"
                  onClick={() => handleSort('fecha')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Fecha Actualización</span>
                    {sortColumn === 'fecha' && (
                      <svg className={`h-4 w-4 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-4 font-semibold cursor-pointer hover:bg-gray-800 transition-colors select-none"
                  onClick={() => handleSort('gestor')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Gestor / Sponsor</span>
                    {sortColumn === 'gestor' && (
                      <svg className={`h-4 w-4 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-4 font-semibold cursor-pointer hover:bg-gray-800 transition-colors select-none"
                  onClick={() => handleSort('estado')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Estado de Aplicación</span>
                    {sortColumn === 'estado' && (
                      <svg className={`h-4 w-4 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-4 font-semibold cursor-pointer hover:bg-gray-800 transition-colors select-none"
                  onClick={() => handleSort('impacto')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Puntuación Impacto</span>
                    {sortColumn === 'impacto' && (
                      <svg className={`h-4 w-4 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-4 font-semibold cursor-pointer hover:bg-gray-800 transition-colors select-none"
                  onClick={() => handleSort('ods')}
                >
                  <div className="flex items-center space-x-1">
                    <span>ODS Detectados</span>
                    {sortColumn === 'ods' && (
                      <svg className={`h-4 w-4 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {groupedFunds.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                    {searchText ? 'No se encontraron fondos que coincidan con tu búsqueda.' : 'No hay fondos disponibles.'}
                  </td>
                </tr>
              ) : (
                groupedFunds.map((group, index) => {
                  const selectedSubfundIndex = selectedSubfundByGroup[group.key] ?? 0;
                  const fund = group.funds[selectedSubfundIndex] || group.funds[0];

                  return (
                  <tr 
                    key={`${group.key}-${index}`} 
                    className="hover:bg-gray-700/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedFund(fund)}
                  >
                    <td className="px-6 py-4 text-gray-200 font-medium">
                      {group.funds.length > 1 ? (
                        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={selectedSubfundIndex}
                            onChange={(e) =>
                              setSelectedSubfundByGroup((prev) => ({
                                ...prev,
                                [group.key]: Number(e.target.value),
                              }))
                            }
                            className="bg-gray-700 text-gray-200 border border-gray-600 rounded-lg py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
                          >
                            {group.funds.map((subfund, subIndex) => (
                              <option key={`${subfund.ticker_isin}-${subIndex}`} value={subIndex}>
                                {subfund.nombre_fondo} {subfund.ticker_isin ? `(${subfund.ticker_isin})` : ''}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-400">
                            {group.funds.length} subcategorías agrupadas por la misma URL
                          </p>
                        </div>
                      ) : (
                        <span className="whitespace-nowrap">{fund.nombre_fondo}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-300 whitespace-nowrap">
                      {getFundTypeValue(fund)}
                    </td>
                    <td className="px-6 py-4 text-gray-300 whitespace-nowrap">
                      {(() => {
                        const date = fund.updated_at || fund.fecha_scrapeo;
                        return new Date(date).toLocaleDateString('es-ES', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        });
                      })()}
                    </td>
                    <td className="px-6 py-4 text-gray-300">
                      {fund.gestor_activos}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                          !fund.applicationStatus
                          ? 'bg-gray-700/50 text-gray-400 border border-gray-600'
                          : fund.applicationStatus === 'PENDIENTE'
                          ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-700' 
                          : 'bg-green-900/50 text-green-300 border border-green-700'
                      }`}>
                          {fund.applicationStatus || 'Sin definir'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                       <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          fund.alineacion_detectada.puntuacion_impacto.toLowerCase().includes('alta') || fund.alineacion_detectada.puntuacion_impacto.toLowerCase().includes('muy alta')
                          ? 'bg-green-900/50 text-green-300 border border-green-800'
                          : 'bg-yellow-900/50 text-yellow-300 border border-yellow-800'
                       }`}>
                          {fund.alineacion_detectada.puntuacion_impacto.split('.')[0]}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-gray-400 max-w-xs truncate">
                      {fund.alineacion_detectada.ods_encontrados.map(ods => ods.split(':')[0]).join(', ')}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fund Detail Modal */}
      {selectedFund && (
        <FundDetailModal 
          fund={selectedFund}
          userId={userId}
          onClose={() => setSelectedFund(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;

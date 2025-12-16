
import React from 'react';
import { Fund, CompanyProfile } from '../types';
import FundCard from './FundCard';
import DownloadIcon from './icons/DownloadIcon';

interface ResultsDisplayProps {
  funds: Fund[];
  userProfile?: CompanyProfile;
  onFundUpdate: (fundName: string, status: string) => void;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ funds, userProfile, onFundUpdate }) => {
  const downloadJSON = () => {
    const dataStr = JSON.stringify(funds, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `${new Date().toISOString().slice(0, 10)}_fondos.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };
  
  const convertToCSV = (data: Fund[]): string => {
    const header = 'nombre_fondo,gestor_activos,ticker_isin,ods_encontrados,url_fuente,fecha_scrapeo';
    const rows = data.map(fund => {
      const ods = `"${fund.alineacion_detectada.ods_encontrados.join(', ')}"`;
      const values = [
        `"${fund.nombre_fondo.replace(/"/g, '""')}"`,
        `"${fund.gestor_activos.replace(/"/g, '""')}"`,
        `"${fund.ticker_isin}"`,
        ods,
        `"${fund.url_fuente}"`,
        `"${fund.fecha_scrapeo}"`
      ];
      return values.join(',');
    });
    return [header, ...rows].join('\n');
  };

  const downloadCSV = () => {
    const csvData = convertToCSV(funds);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const exportFileDefaultName = `${new Date().toISOString().slice(0, 10)}_fondos.csv`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', url);
    linkElement.setAttribute('download', exportFileDefaultName);
    document.body.appendChild(linkElement);
    linkElement.click();
    document.body.removeChild(linkElement);
  };

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h3 className="text-xl font-semibold text-gray-300">
          Listado de Oportunidades
        </h3>
        <div className="flex space-x-3 flex-wrap justify-end gap-y-2">
          <div className="flex space-x-2">
            <button
                onClick={downloadJSON}
                className="flex items-center bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-300 font-medium py-2 px-4 rounded-md transition-colors duration-300 text-sm"
            >
                <DownloadIcon className="w-4 h-4 mr-2" />
                JSON
            </button>
            <button
                onClick={downloadCSV}
                className="flex items-center bg-blue-900/30 border border-blue-800 hover:bg-blue-800/50 text-blue-200 font-medium py-2 px-4 rounded-md transition-colors duration-300 text-sm"
            >
                <DownloadIcon className="w-4 h-4 mr-2" />
                CSV
            </button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6">
        {funds.map((fund, index) => (
          <FundCard 
            key={`${fund.ticker_isin}-${index}`} 
            fund={fund} 
            userProfile={userProfile}
            onStatusUpdate={onFundUpdate}
          />
        ))}
      </div>
    </div>
  );
};

export default ResultsDisplay;


import React, { useMemo } from 'react';
import { Fund } from '../types';

interface DashboardProps {
  funds: Fund[];
}

const Dashboard: React.FC<DashboardProps> = ({ funds }) => {
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
          <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">Total DAFs</p>
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
          <h3 className="text-lg font-semibold text-gray-200">Resumen Ejecutivo de Fondos</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-900 text-gray-400 uppercase tracking-wider text-xs">
              <tr>
                <th scope="col" className="px-6 py-4 font-semibold">Nombre del Fondo</th>
                <th scope="col" className="px-6 py-4 font-semibold">Gestor / Sponsor</th>
                <th scope="col" className="px-6 py-4 font-semibold">Estado de Aplicación</th>
                <th scope="col" className="px-6 py-4 font-semibold">Puntuación Impacto</th>
                <th scope="col" className="px-6 py-4 font-semibold">ODS Detectados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {funds.map((fund, index) => (
                <tr key={`${fund.ticker_isin}-${index}`} className="hover:bg-gray-700/30 transition-colors">
                  <td className="px-6 py-4 text-gray-200 font-medium whitespace-nowrap">
                    {fund.nombre_fondo}
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

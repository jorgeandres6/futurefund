import React from 'react';
import SpinnerIcon from './icons/SpinnerIcon';

interface SearchBarProps {
  onSearch: () => void;
  onStop: () => void;
  isLoading: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, onStop, isLoading }) => {
  return (
    <div className="flex justify-center items-center w-full my-4">
      {isLoading ? (
        <button
          onClick={onStop}
          className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-8 rounded-full transition-all duration-300 flex items-center justify-center w-full sm:w-auto min-w-[320px] text-lg shadow-lg border border-red-500 hover:shadow-red-900/50"
        >
          <span className="mr-3 font-bold text-xl leading-none pb-1">■</span> Detener Búsqueda
        </button>
      ) : (
        <button
          onClick={onSearch}
          className="bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white font-semibold py-3 px-8 rounded-full transition-all duration-300 flex items-center justify-center w-full sm:w-auto min-w-[320px] text-lg shadow-lg"
        >
          Iniciar Búsqueda Exhaustiva
        </button>
      )}
    </div>
  );
};

export default SearchBar;
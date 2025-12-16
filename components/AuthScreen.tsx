
import React, { useState } from 'react';
import { User } from '../types';
import SpinnerIcon from './icons/SpinnerIcon';

interface AuthScreenProps {
  onLogin: (user: User, isSignup?: boolean) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Simular pequeño delay para UX
    await new Promise(resolve => setTimeout(resolve, 800));

    if (!formData.email || !formData.password) {
      setError('Por favor completa todos los campos requeridos.');
      setIsLoading(false);
      return;
    }

    if (!isLoginMode && !formData.name) {
      setError('Por favor ingresa tu nombre.');
      setIsLoading(false);
      return;
    }

    // Access "Database" from localStorage
    const usersDbStr = localStorage.getItem('users_db');
    const usersDb: User[] = usersDbStr ? JSON.parse(usersDbStr) : [];

    if (!isLoginMode) {
      // --- SIGNUP LOGIC (PERSISTENT) ---
      
      // Check for duplicates
      if (usersDb.some(u => u.email === formData.email)) {
        setError('Ya existe una cuenta registrada con este correo electrónico.');
        setIsLoading(false);
        return;
      }

      const newUser: User = {
        name: formData.name,
        email: formData.email,
        password: formData.password, // Store password
        profile: undefined // New users have no profile initially
      };

      // Save to DB
      usersDb.push(newUser);
      localStorage.setItem('users_db', JSON.stringify(usersDb));

      setIsLoading(false);
      onLogin(newUser, true);

    } else {
      // --- LOGIN LOGIC (PERSISTENT) ---
      
      const foundUser = usersDb.find(u => u.email === formData.email && u.password === formData.password);

      if (foundUser) {
        setIsLoading(false);
        // Pass the user found in DB, which might contain a saved profile
        onLogin(foundUser, false);
      } else {
        setError('Credenciales inválidas. Verifica tu correo y contraseña.');
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-gray-900 p-4">
      <div className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden relative">
        {/* Background Accent */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400"></div>
        
        <div className="p-8">
          <div className="text-center mb-8 flex flex-col items-center">
             {/* Logo Section */}
             <div className="mb-4">
                 <img 
                    src="/logoff.png" 
                    alt="FutureFund Logo" 
                    className="w-24 h-24 object-contain mb-4"
                    onError={(e) => {
                        e.currentTarget.style.display = 'none';
                    }}
                 />
             </div>

            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
              FutureFund
            </h1>
            <p className="text-gray-400 text-sm">
              {isLoginMode 
                ? 'Accede al buscador de fondos de inversión ODS/Reciclaje' 
                : 'Únete a la plataforma de financiamiento sostenible'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLoginMode && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Ej. Juan Pérez"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Correo Electrónico</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="nombre@ejemplo.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Contraseña</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-red-400 text-sm text-center bg-red-900/20 p-2 rounded border border-red-900/50">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
            >
              {isLoading ? (
                <SpinnerIcon className="w-6 h-6 animate-spin" />
              ) : (
                isLoginMode ? 'Iniciar Sesión' : 'Registrarse'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              {isLoginMode ? "¿No tienes una cuenta? " : "¿Ya tienes una cuenta? "}
              <button
                onClick={() => {
                  setIsLoginMode(!isLoginMode);
                  setError('');
                  setFormData({ name: '', email: '', password: '' });
                }}
                className="text-blue-400 hover:text-blue-300 font-semibold underline transition-colors"
              >
                {isLoginMode ? 'Regístrate aquí' : 'Inicia Sesión'}
              </button>
            </p>
          </div>
        </div>
      </div>
      
      <div className="mt-8 text-gray-500 text-xs">
        &copy; 2024 FutureFund - Algoritmo de Web Scraping Diario
      </div>
    </div>
  );
};

export default AuthScreen;

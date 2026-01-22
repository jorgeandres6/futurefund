
import React, { useState } from 'react';
import { User } from '../types';
import SpinnerIcon from './icons/SpinnerIcon';
import logo from '../logoff.png';
import { supabase } from '../services/supabaseClient';

interface AuthScreenProps {
  onLogin: (user: User, isSignup?: boolean) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState('');
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

    try {
      if (!isLoginMode) {
        // --- SIGNUP LOGIC WITH SUPABASE ---
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              name: formData.name,
            }
          }
        });

        if (signUpError) {
          setError(signUpError.message);
          setIsLoading(false);
          return;
        }

        if (data.user) {
          // Show email confirmation modal
          setConfirmationEmail(formData.email);
          setShowEmailConfirmation(true);
          setIsLoading(false);
          
          // Reset form
          setFormData({ name: '', email: '', password: '' });
        }
      } else {
        // --- LOGIN LOGIC WITH SUPABASE ---
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (signInError) {
          setError('Credenciales inválidas. Verifica tu correo y contraseña.');
          setIsLoading(false);
          return;
        }

        if (data.user) {
          const userName = data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Usuario';
          
          const loggedInUser: User = {
            name: userName,
            email: data.user.email!,
            profile: undefined
          };

          setIsLoading(false);
          onLogin(loggedInUser, false);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error. Inténtalo de nuevo.');
      setIsLoading(false);
    }
  };

  const handleCloseConfirmation = () => {
    setShowEmailConfirmation(false);
    setConfirmationEmail('');
    setIsLoginMode(true);
    setFormData({ name: '', email: '', password: '' });
    setError('');
  };

  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-gray-900 p-4">
      {/* Email Confirmation Modal */}
      {showEmailConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-gray-800 border border-green-500/30 rounded-2xl shadow-2xl overflow-hidden">
            {/* Success Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-white/20 rounded-full p-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white">¡Registro Exitoso!</h2>
              <p className="text-green-100 text-sm mt-2">Tu cuenta ha sido creada correctamente</p>
            </div>

            {/* Content */}
            <div className="p-8">
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
                <p className="text-blue-200 text-sm leading-relaxed">
                  📧 Hemos enviado un <strong>correo de confirmación</strong> a:
                </p>
                <p className="text-white font-semibold mt-2 break-all">{confirmationEmail}</p>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-gray-300 text-sm">Revisa tu bandeja de entrada</p>
                </div>
                <div className="flex gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-gray-300 text-sm">No olvides revisar la carpeta de <strong>spam</strong></p>
                </div>
                <div className="flex gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-gray-300 text-sm">Haz clic en el enlace para confirmar tu email</p>
                </div>
              </div>

              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 mb-6">
                <p className="text-gray-400 text-xs leading-relaxed">
                  <strong>Nota:</strong> El enlace de confirmación es válido por 24 horas. Después deberás solicitar uno nuevo.
                </p>
              </div>

              <button
                onClick={handleCloseConfirmation}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform transition-all duration-200 hover:-translate-y-0.5"
              >
                Volver a Iniciar Sesión
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden relative">
        {/* Background Accent */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400"></div>
        
        <div className="p-8">
          <div className="text-center mb-8 flex flex-col items-center">
             {/* Logo Section */}
             <div className="mb-4">
                 <img 
                    src={logo} 
                    alt="FutureFund Logo" 
                    className="w-10 h-10 object-contain mb-4"
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

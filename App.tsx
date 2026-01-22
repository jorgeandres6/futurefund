
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Fund, User, CompanyProfile } from './types';
import { 
  discoverFinancingSources, 
  expandSearch, 
  discoverEcuadorFinancingSources, 
  expandEcuadorSearch,
  getDemoData,
  generateCompanyProfileSummary
} from './services/geminiService';
import { supabase } from './services/supabaseClient';
import { saveProfile, loadProfile, saveFunds, loadFunds, updateFundStatus, saveFundAnalysis } from './services/supabaseService';
import { autoAnalyzeFundsForPremium } from './services/webReviewService';
import SearchBar from './components/SearchBar';
import Dashboard from './components/Dashboard';
import AuthScreen from './components/AuthScreen';
import OnboardingForm from './components/OnboardingForm';
import SpinnerIcon from './components/icons/SpinnerIcon';
import logo from './logoff.png';
import ResultsDisplay from './components/ResultsDisplay';
import ProfileView from './components/ProfileView';


const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(null); // Store Supabase user ID
  const [funds, setFunds] = useState<Fund[]>([]);
  const [areFundsLoaded, setAreFundsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true); // Loading initial session
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'search' | 'dashboard' | 'profile'>('search');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  
  // Ref for aborting search
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check for existing Supabase session on mount
  useEffect(() => {
    const initializeSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const userName = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuario';
          
          // Load profile from Supabase
          const profile = await loadProfile(session.user.id);
          
          const loggedInUser: User = {
            name: userName,
            email: session.user.email!,
            profile: profile || undefined
          };

          setUser(loggedInUser);
          setUserId(session.user.id);

          // Load funds from Supabase
          const userFunds = await loadFunds(session.user.id);
          setFunds(userFunds);
          setAreFundsLoaded(true);

          // Show onboarding if no profile
          if (!profile) {
            setShowOnboarding(true);
          }
        }
      } catch (error) {
        console.error('Error initializing session:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setUserId(null);
        setFunds([]);
        setAreFundsLoaded(false);
        setShowOnboarding(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Persist funds to Supabase when they change
  useEffect(() => {
    const persistFunds = async () => {
      if (userId && areFundsLoaded && funds.length > 0) {
        try {
          await saveFunds(userId, funds);
        } catch (error) {
          console.error('Error persisting funds:', error);
        }
      }
    };

    persistFunds();
  }, [funds, userId, areFundsLoaded]);

  const handleLogin = async (newUser: User, isSignup: boolean = false) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUserId(session.user.id);

        // Load profile from Supabase
        const profile = await loadProfile(session.user.id);
        
        const userWithProfile = {
          ...newUser,
          profile: profile || undefined
        };

        setUser(userWithProfile);

        // Load funds from Supabase
        const userFunds = await loadFunds(session.user.id);
        setFunds(userFunds);
        setAreFundsLoaded(true);

        // Show onboarding if new signup or no profile
        if (isSignup || !profile) {
          setShowOnboarding(true);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleOnboardingSubmit = async (profile: CompanyProfile) => {
    if (user && userId) {
      setIsCreatingProfile(true);
      
      try {
        // Generate AI summary
        const aiSummary = await generateCompanyProfileSummary(profile);
        
        const profileWithBio = { ...profile, aiGeneratedSummary: aiSummary };

        // Save to Supabase
        await saveProfile(userId, profileWithBio);

        // Update local state
        const updatedUser = { ...user, profile: profileWithBio };
        setUser(updatedUser);
        
        // Close onboarding and redirect to profile
        setShowOnboarding(false);
        setActiveTab('profile');
      } catch (error) {
        console.error("Error creating profile:", error);
        setError("Hubo un problema creando tu perfil. Por favor intenta nuevamente.");
      } finally {
        setIsCreatingProfile(false);
      }
    }
  };

  const handleProfileUpdate = async (updatedProfile: CompanyProfile) => {
    if (user && userId) {
      try {
        // Save to Supabase
        await saveProfile(userId, updatedProfile);

        // Update local state
        const updatedUser = { ...user, profile: updatedProfile };
        setUser(updatedUser);
      } catch (error) {
        console.error("Error updating profile:", error);
        setError("Hubo un problema actualizando tu perfil.");
      }
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setAreFundsLoaded(false);
      setUser(null);
      setUserId(null);
      setFunds([]); 
      setActiveTab('search');
      setShowOnboarding(false);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleFundUpdate = useCallback(async (fundName: string, newStatus: string) => {
    // Update local state
    setFunds(currentFunds => 
      currentFunds.map(f => 
        f.nombre_fondo === fundName 
          ? { ...f, applicationStatus: newStatus } 
          : f
      )
    );

    // Update in Supabase
    if (userId) {
      try {
        await updateFundStatus(userId, fundName, newStatus);
      } catch (error) {
        console.error('Error updating fund status:', error);
      }
    }
  }, [userId]);

  const handleStopSearch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setLoadingMessage('Búsqueda detenida por el usuario.');
      setError('La búsqueda fue detenida manualmente.');
    }
  }, []);

  const handleSearch = useCallback(async () => {
    // Cancel any previous running search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new controller
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    // Remove automatic tab switch to keep user on search results
    // setActiveTab('search'); 
    setIsLoading(true);
    setError(null);

    // Función auxiliar para añadir fondos incrementalmente sin duplicados
    const addFunds = (newFunds: Fund[]) => {
      setFunds(prevFunds => {
        // Create a map of existing funds statuses to preserve them
        const existingStatusMap = new Map(prevFunds.map(f => [f.nombre_fondo.trim().toLowerCase(), f.applicationStatus]));
        
        const initializedNewFunds = newFunds.map(f => ({
            ...f,
            // Preserve existing status if found, otherwise default to PENDIENTE
            applicationStatus: existingStatusMap.get(f.nombre_fondo.trim().toLowerCase()) || 'PENDIENTE'
        }));

        const allFunds = [...prevFunds, ...initializedNewFunds];
        // Usamos un Map para eliminar duplicados basados en el nombre del fondo (normalizado)
        // Note: Since newFunds come last, they update the data but we preserved the status above
        const uniqueResults = Array.from(new Map(allFunds.map(fund => [fund.nombre_fondo.trim().toLowerCase(), fund])).values());
        return uniqueResults;
      });
    };

    try {
      // Get current user profile for context
      const profile = user?.profile;

      // Fase 0: Carga Inmediata de Demo (Datos Verificados)
      // Check abort signal before starting heavy work
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      
      setLoadingMessage('Inicializando FutureFund con referencias verificadas...');
      const demoData = getDemoData();
      addFunds(demoData);

      // Fase 1: Descubrimiento Global (DAFs y Tipos de Financiamiento del Perfil)
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      setLoadingMessage(profile 
        ? `Fase 1/4: Analizando oportunidades de ${profile.financingType.join(', ')} globales...` 
        : 'Fase 1/4: Analizando DAFs globales y tendencias...');
      const globalInitialResults = await discoverFinancingSources(signal, profile);
      addFunds(globalInitialResults);

      // Fase 2: Expansión Global (Nicho)
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      setLoadingMessage('Fase 2/4: Profundizando en fondos de inversión ODS...');
      const globalExpandedResults = await expandSearch(globalInitialResults, signal, profile);
      addFunds(globalExpandedResults);

      // Fase 3: Descubrimiento Ecuador (Local)
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      setLoadingMessage('Fase 3/4: Buscando estructuras y fondos para Reciclaje/ODS...');
      const ecuadorInitialResults = await discoverEcuadorFinancingSources(signal, profile);
      addFunds(ecuadorInitialResults);

      // Fase 4: Expansión Ecuador (Cooperación)
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      setLoadingMessage('Fase 4/4: Finalizando reporte de capital...');
      const ecuadorExpandedResults = await expandEcuadorSearch(ecuadorInitialResults, signal, profile);
      addFunds(ecuadorExpandedResults);

      // Fase 5: Análisis automático para usuarios premium (solo fondos nuevos sin análisis previo)
      if (profile?.userType === 'premium') {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        
        setLoadingMessage('🔍 Analizando proceso de aplicación automáticamente (Premium)...');
        
        // Obtener todos los fondos actuales
        const allCurrentFunds = [...funds];
        
        // Analizar automáticamente fondos sin análisis previo
        const analysisResults = await autoAnalyzeFundsForPremium(
          allCurrentFunds,
          (current, total, fundName) => {
            setLoadingMessage(`🔍 Analizando ${current}/${total}: ${fundName}...`);
          },
          signal
        );

        // Actualizar fondos con los análisis obtenidos y guardar en Supabase
        setFunds(currentFunds => {
          return currentFunds.map(fund => {
            const analysis = analysisResults.get(fund.nombre_fondo);
            if (analysis) {
              // Guardar análisis en Supabase de forma asíncrona
              if (userId) {
                saveFundAnalysis(userId, fund.nombre_fondo, analysis).catch(err => 
                  console.error('Error saving analysis:', err)
                );
              }
              return {
                ...fund,
                analisis_aplicacion: analysis
              };
            }
            return fund;
          });
        });
      }

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Búsqueda abortada');
        // El estado de error/mensaje ya se maneja en handleStopSearch o aquí si es necesario
      } else {
        console.error(err);
        setError(`La búsqueda se interrumpió, pero se guardaron los resultados obtenidos. Detalle: ${err.message || 'Error de conexión'}`);
      }
    } finally {
      // Only set loading to false if this is the active controller
      if (abortControllerRef.current === controller) {
         setIsLoading(false);
         setLoadingMessage('');
         abortControllerRef.current = null;
      }
    }
  }, [user]);

  // Show loading screen while checking session
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-center p-4">
        <div className="bg-gray-800/50 p-8 rounded-2xl border border-gray-700 shadow-2xl backdrop-blur-sm max-w-md w-full flex flex-col items-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
            <SpinnerIcon className="w-16 h-16 text-blue-400 relative z-10 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Cargando FutureFund</h2>
          <p className="text-gray-400">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show Auth Screen
  if (!user) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  // If creating profile (Loading Screen)
  if (isCreatingProfile) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-center p-4 animate-fade-in">
        <div className="bg-gray-800/50 p-8 rounded-2xl border border-gray-700 shadow-2xl backdrop-blur-sm max-w-md w-full flex flex-col items-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
            <SpinnerIcon className="w-16 h-16 text-blue-400 relative z-10 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Creando perfil FutureFund</h2>
          <p className="text-gray-400 mb-6">
            Nuestra IA está analizando tu documentación y generando un resumen ejecutivo optimizado.
          </p>
          <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden mb-2">
            <div className="bg-gradient-to-r from-blue-500 to-green-400 h-full w-full animate-pulse-slow"></div>
          </div>
          <p className="text-xs text-gray-500">Esto puede tomar unos segundos...</p>
        </div>
      </div>
    );
  }

  // If authenticated but needs onboarding (new user)
  if (showOnboarding) {
    return <OnboardingForm onSubmit={handleOnboardingSubmit} userName={user.name} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      {/* Header Bar with Logout */}
      <div className="w-full max-w-6xl mx-auto flex justify-between items-center mb-4">
         <div className="flex items-center gap-4">
            {/* Small Logo for Header */}
            <div className="flex items-center gap-2">
                <img 
                    src={logo} 
                    alt="Logo" 
                    className="w-4 h-4 object-contain"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <span className="font-bold text-xl tracking-tight text-white hidden sm:block">FutureFund</span>
            </div>

             {/* Show user company info if available */}
             {user.profile && (
                 <button
                    onClick={() => setActiveTab('profile')}
                    className="hidden md:inline-block px-3 py-1 bg-gray-800 border border-gray-700 hover:border-blue-500 rounded-full text-xs text-gray-400 hover:text-blue-300 transition-colors ml-4"
                 >
                     {user.profile.companyName}
                 </button>
             )}
         </div>
         <div className="flex items-center gap-4">
            <div className="flex flex-col text-right">
              <span className="text-xs text-gray-400">Sesión activa</span>
              <span className="text-sm font-semibold text-blue-300">{user.name}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="text-xs bg-gray-800 hover:bg-red-900/30 text-gray-400 hover:text-red-300 border border-gray-700 px-3 py-2 rounded transition-colors"
            >
              Cerrar Sesión
            </button>
         </div>
      </div>

      <div className="w-full max-w-6xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-200 to-white">
            FutureFund
          </h1>
          <p className="mt-2 text-lg text-gray-400">
            Plataforma de búsqueda de Fondos de Inversión ODS y Reciclaje
          </p>
        </header>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8 border-b border-gray-700 w-full overflow-x-auto">
            <button 
                onClick={() => setActiveTab('search')}
                className={`pb-4 px-6 text-lg font-medium transition-colors duration-200 relative whitespace-nowrap ${
                    activeTab === 'search' 
                    ? 'text-blue-400' 
                    : 'text-gray-400 hover:text-gray-200'
                }`}
            >
                Búsqueda
                {activeTab === 'search' && (
                    <span className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600 rounded-t-md"></span>
                )}
            </button>
            <button 
                onClick={() => setActiveTab('dashboard')}
                className={`pb-4 px-6 text-lg font-medium transition-colors duration-200 relative flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'dashboard' 
                    ? 'text-blue-400' 
                    : 'text-gray-400 hover:text-gray-200'
                }`}
            >
                Dashboard
                {funds.length > 0 && (
                  <span className="bg-gray-800 text-xs py-0.5 px-2 rounded-full border border-gray-600 text-gray-300">
                    {funds.length}
                  </span>
                )}
                {activeTab === 'dashboard' && (
                    <span className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-t-md"></span>
                )}
            </button>
            <button 
                onClick={() => setActiveTab('profile')}
                className={`pb-4 px-6 text-lg font-medium transition-colors duration-200 relative flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'profile' 
                    ? 'text-blue-400' 
                    : 'text-gray-400 hover:text-gray-200'
                }`}
            >
                Perfil Corporativo
                {activeTab === 'profile' && (
                    <span className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-t-md"></span>
                )}
            </button>
        </div>

        <main className="w-full">
          {activeTab === 'search' && (
            <div className="flex flex-col items-center justify-start min-h-[400px] animate-fade-in w-full">
                <div className="max-w-2xl text-center mb-6">
                    <h2 className="text-2xl font-semibold text-gray-200 mb-2">Motor de Búsqueda FutureFund</h2>
                    <p className="text-gray-400 text-sm">
                        Inicie una exploración profunda utilizando IA para localizar fondos de inversión alineados con ODS y Reciclaje.
                    </p>
                </div>
                <SearchBar
                    onSearch={handleSearch}
                    onStop={handleStopSearch}
                    isLoading={isLoading}
                />
                 
                {!isLoading && funds.length === 0 && (
                  <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center text-sm text-gray-500 max-w-4xl">
                    <div className="p-4 bg-gray-800/20 rounded-lg border border-gray-800">
                        <strong className="block text-gray-300 mb-1">Fase 1: Global</strong>
                        Identificación de DAFs internacionales y sponsors.
                    </div>
                    <div className="p-4 bg-gray-800/20 rounded-lg border border-gray-800">
                        <strong className="block text-gray-300 mb-1">Fase 2: Nicho ODS</strong>
                        Búsqueda profunda de fondos de reciclaje y sostenibilidad.
                    </div>
                    <div className="p-4 bg-gray-800/20 rounded-lg border border-gray-800">
                        <strong className="block text-gray-300 mb-1">Fase 3: Local</strong>
                        Análisis de oportunidades en Ecuador y Latam.
                    </div>
                  </div>
                )}

                {/* Loading Indicator */}
                {isLoading && (
                    <div className="flex justify-center items-center my-8 bg-gray-800/80 p-6 rounded-xl border border-gray-700/50 w-full max-w-lg backdrop-blur-sm shadow-xl z-10">
                    <SpinnerIcon className="w-10 h-10 text-blue-400 animate-spin" />
                    <div className="ml-4 flex flex-col flex-1">
                        <span className="text-lg font-semibold text-blue-200">Procesando Análisis IA</span>
                        <span className="text-sm text-gray-400">{loadingMessage}</span>
                    </div>
                     <button 
                        onClick={handleStopSearch}
                        className="ml-4 p-2 text-gray-400 hover:text-red-400 transition-colors"
                        title="Detener"
                     >
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                       </svg>
                     </button>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="mb-8 text-center bg-red-900/30 border border-red-700/50 text-red-200 px-4 py-3 rounded-lg w-full max-w-3xl" role="alert">
                    <strong className="font-bold">Aviso del Sistema: </strong>
                    <span className="block sm:inline">{error}</span>
                    </div>
                )}

                {/* Results List */}
                {funds.length > 0 && (
                   <div className="w-full mt-8 animate-slide-up">
                      <ResultsDisplay 
                          funds={funds} 
                          userProfile={user?.profile} 
                          onFundUpdate={handleFundUpdate}
                      />
                   </div>
                )}
            </div>
          )}

          {activeTab === 'dashboard' && (
             <div className="flex flex-col items-center w-full animate-fade-in">
                {funds.length > 0 ? (
                    <Dashboard funds={funds} />
                ) : (
                    <div className="text-center mt-12 p-12 bg-gray-800/20 rounded-2xl border border-gray-700/30 max-w-2xl mx-auto flex flex-col items-center">
                        <div className="p-4 bg-gray-800 rounded-full mb-6">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-semibold text-gray-300">Dashboard Vacío</h2>
                        <p className="mt-4 text-gray-400">
                            Vaya a la pestaña <strong>Búsqueda</strong> para iniciar el proceso de identificación de fondos. Los resultados aparecerán aquí.
                        </p>
                        <button 
                            onClick={() => setActiveTab('search')}
                            className="mt-6 text-blue-400 hover:text-blue-300 font-medium underline"
                        >
                            Ir a Búsqueda
                        </button>
                    </div>
                )}
             </div>
          )}

          {activeTab === 'profile' && user?.profile && (
              <ProfileView 
                profile={user.profile} 
                onUpdateProfile={handleProfileUpdate}
              />
          )}

          {activeTab === 'profile' && !user?.profile && (
              <div className="text-center mt-12 text-gray-400">
                  No se ha configurado el perfil de empresa.
              </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;

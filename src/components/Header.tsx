import React from 'react';
import { RefreshCw, ShieldAlert, LayoutDashboard, History, Waves, Lock } from 'lucide-react';

interface HeaderProps {
  ultimaActualizacion: string;
  isRefreshing: boolean;
  cooldownMinutesLeft?: number;
  onRefresh: () => void;
  soloCriticos: boolean;
  onToggleSoloCriticos: () => void;
  onOpenHistory: () => void;
  onOpenOcean: () => void;
  currentView: 'live' | 'history_audit';
  onChangeView: (view: 'live' | 'history_audit') => void;
}

export const Header: React.FC<HeaderProps> = ({
  ultimaActualizacion,
  isRefreshing,
  cooldownMinutesLeft = 0,
  onRefresh,
  soloCriticos,
  onToggleSoloCriticos,
  onOpenHistory,
  onOpenOcean,
  currentView,
  onChangeView
}) => {
  const isRefreshLocked = cooldownMinutesLeft > 0;
  return (
    <header className="bg-[#7300E1] text-white shadow-md border-b border-[#5e00b8] sticky top-0 z-30">
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Brand & Identity */}
        <div className="flex items-center gap-3.5 self-start md:self-auto">
          {/* Real Plaza Stylized Monogram */}
          <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0">
            <span className="font-extrabold text-2xl tracking-tighter text-[#7300E1]">RP</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black tracking-wide text-xl text-white">MONITOR CLIMÁTICO</span>
              <span className="bg-[#FFC740] text-black font-extrabold text-xs px-2.5 py-0.5 rounded tracking-wider uppercase">
                REAL PLAZA
              </span>
              <span className="bg-emerald-400 text-neutral-950 font-black text-xs px-2.5 py-0.5 rounded tracking-wider uppercase shadow-2xs">
                MODELO B
              </span>
            </div>
            <p className="text-sm text-purple-200 font-medium tracking-tight">
              Centro de Control Preventivo · Mantenimiento y Operaciones
            </p>
          </div>
        </div>

        {/* Center: Main View Navigation Switcher */}
        <div className="flex items-center bg-[#5400a4] p-1.5 rounded-xl border border-purple-400/25 shadow-inner">
          <button
            onClick={() => onChangeView('live')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
              currentView === 'live'
                ? 'bg-white text-[#7300E1] shadow-xs'
                : 'text-purple-200 hover:text-white hover:bg-white/10'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Monitor en Vivo</span>
          </button>

          <button
            onClick={() => onChangeView('history_audit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
              currentView === 'history_audit'
                ? 'bg-[#FFC740] text-black shadow-xs font-black'
                : 'text-purple-200 hover:text-white hover:bg-white/10'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historial y Auditoría</span>
            <span className="text-[11px] px-2 py-0.5 bg-purple-900/60 text-[#FFC740] rounded font-bold uppercase tracking-wider ml-1">
              Días Pasados
            </span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap self-end md:self-auto">
          
          {/* Toggle Solo Críticos (only relevant in live view) */}
          {currentView === 'live' && (
            <button
              onClick={onToggleSoloCriticos}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-bold transition-all shadow-xs cursor-pointer ${
                soloCriticos
                  ? 'bg-[#FFC740] text-neutral-950 ring-2 ring-white/50'
                  : 'bg-[#8918ff] hover:bg-[#972dfa] text-white border border-purple-400/30'
              }`}
              title="Filtrar únicamente sedes en Alerta o Preventivo"
            >
              <ShieldAlert className={`w-4 h-4 ${soloCriticos ? 'text-red-700' : 'text-yellow-300'}`} />
              <span>{soloCriticos ? 'Solo Críticos: ACTIVO' : 'Solo Críticos'}</span>
            </button>
          )}

          {/* Ocean / ENFEN Monitor Modal Button */}
          <button
            onClick={onOpenOcean}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold bg-[#5d00b5] hover:bg-[#6b09cd] text-white border border-purple-400/30 transition-colors cursor-pointer"
            title="Ver datos océano-atmosféricos ENFEN / Niño 1+2"
          >
            <Waves className="w-4 h-4 text-[#4ABFFF]" />
            <span className="hidden sm:inline">Niño 1+2 / ENFEN</span>
          </button>

          {/* History Log Repository Button */}
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold bg-[#5d00b5] hover:bg-[#6b09cd] text-white border border-purple-400/30 transition-colors cursor-pointer"
            title="Repositorio histórico de calibración Pronóstico vs Real"
          >
            <History className="w-4 h-4 text-purple-200" />
            <span className="hidden sm:inline">Historial</span>
          </button>

          {/* Refresh Data Button (protected by 30-min cooldown & auto-refresh) */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing || isRefreshLocked}
            title={
              isRefreshLocked
                ? `Protección activa: actualización automática cada 30 min para evitar saturación. Próxima recarga en ${cooldownMinutesLeft} min${ultimaActualizacion ? ` (Última: ${ultimaActualizacion})` : ''}.`
                : 'Actualizar datos meteorológicos en vivo (protegido cada 30 min)'
            }
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm ${
              isRefreshLocked && !isRefreshing
                ? 'bg-[#5400a4] text-purple-100 border border-purple-300/35 cursor-not-allowed opacity-90'
                : 'bg-white text-[#7300E1] hover:bg-neutral-100 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed'
            }`}
          >
            {isRefreshing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : isRefreshLocked ? (
              <Lock className="w-3.5 h-3.5 text-[#FFC740]" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span>
              {isRefreshing
                ? 'Actualizando...'
                : isRefreshLocked
                ? `Actualizado · ${cooldownMinutesLeft}m`
                : 'Actualizar'}
            </span>
          </button>

        </div>

      </div>
    </header>
  );
};

import React, { useState } from 'react';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Grid3X3,
  Flame,
  Wine,
  Wallet,
  Receipt,
  FileCheck2,
  BookOpen,
  Users,
  Boxes,
  BarChart3,
  Settings,
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
  PlayCircle,
  ChevronDown,
  Globe,
  ArrowRightLeft,
  Bell,
  Layers,
  ShieldCheck,
  Home,
  CheckCircle2,
  Share2,
  Smartphone,
  Sun,
  Moon,
  Key,
} from 'lucide-react';
import { User, Table, Comanda, Product, ModuleType } from '../types';
import { store } from '../services/storage';
import { useTheme } from '../services/theme';
import { PWAInstallButton } from './PWAInstallButton';

interface NavbarProps {
  currentModule: ModuleType | 'portal';
  onSelectModule: (module: ModuleType | 'portal') => void;
  currentUser: User;
  onOpenOperatorModal: () => void;
  onOpenScenarioModal: () => void;
  onOpenShiftHandoverModal?: () => void;
  tables: Table[];
  comandas: Comanda[];
  products: Product[];
  isOnline: boolean;
  soundEnabled: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentModule,
  onSelectModule,
  currentUser,
  onOpenOperatorModal,
  onOpenScenarioModal,
  onOpenShiftHandoverModal,
  tables,
  comandas,
  products,
  isOnline,
  soundEnabled,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const [moduleDropdownOpen, setModuleDropdownOpen] = useState(false);

  // Contadores para badges em tempo real
  const activeComandas = comandas.filter((c) => c.status === 'aberta' || c.status === 'conta_solicitada');
  const occupiedTables = tables.filter((t) => t.status === 'ocupada' || t.status === 'conta_solicitada');
  const pendingTableCalls = tables.filter((t) => !!t.activeCall).length;

  // Prontos a entregar no atendimento
  const readyItemsCount = comandas.reduce((acc, c) => {
    return (
      acc +
      c.rounds.reduce((rAcc, r) => {
        return rAcc + r.items.filter((i) => i.status === 'pronto').length;
      }, 0)
    );
  }, 0);

  // Cozinha pendente
  const kitchenPending = comandas.reduce((acc, c) => {
    return (
      acc +
      c.rounds.reduce((rAcc, r) => {
        return (
          rAcc +
          r.items.filter(
            (i) => (i.sector === 'cozinha' || i.sector === 'pastelaria') && (i.status === 'recebido' || i.status === 'em_preparacao')
          ).length
        );
      }, 0)
    );
  }, 0);

  // Bar pendente
  const barPending = comandas.reduce((acc, c) => {
    return (
      acc +
      c.rounds.reduce((rAcc, r) => {
        return rAcc + r.items.filter((i) => i.sector === 'bar' && (i.status === 'recebido' || i.status === 'em_preparacao')).length;
      }, 0)
    );
  }, 0);

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    manager: 'Gerente Operacional',
    waiter: 'Empregado de Mesa',
    kitchen: 'Cozinha / Copa',
    bar: 'Equipa do Bar',
    cashier: 'Operador de Caixa',
  };

  const moduleMeta: Record<ModuleType | 'portal', { label: string; icon: any; color: string; badge?: string | number }> = {
    portal: { label: 'Portal Inicial', icon: Home, color: 'text-stone-300' },
    atendimento: {
      label: 'Atendimento',
      icon: UtensilsCrossed,
      color: 'text-amber-400',
      badge: readyItemsCount > 0 ? `${readyItemsCount} pronto` : undefined,
    },
    cozinha: {
      label: 'Cozinha / Copa',
      icon: Flame,
      color: 'text-orange-400',
      badge: kitchenPending > 0 ? `${kitchenPending}` : undefined,
    },
    bar: {
      label: 'Bar',
      icon: Wine,
      color: 'text-cyan-400',
      badge: barPending > 0 ? `${barPending}` : undefined,
    },
    admin: {
      label: 'Administração',
      icon: ShieldCheck,
      color: 'text-purple-400',
      badge: activeComandas.filter((c) => c.status === 'conta_solicitada').length > 0 ? 'Conta!' : undefined,
    },
    faturacao: {
      label: 'Faturação & Notas',
      icon: FileCheck2,
      color: 'text-emerald-400',
    },
  };

  const isAdminOrManager = currentUser.role === 'admin' || currentUser.role === 'manager';

  const handleSelectModuleSafe = (mod: ModuleType | 'portal') => {
    setModuleDropdownOpen(false);
    if (mod === 'portal') {
      onSelectModule('portal');
      return;
    }
    if (store.canUserAccessModule(currentUser, mod)) {
      onSelectModule(mod);
    } else {
      alert(`Acesso restrito: A sua conta individual (${currentUser.name} - ${roleLabels[currentUser.role]}) não possui permissão para aceder a este módulo.`);
    }
  };

  const CurrentIcon = moduleMeta[currentModule].icon;

  return (
    <header className={`bg-stone-950 border-b border-stone-800 text-stone-200 select-none sticky top-0 z-40 ${currentModule === 'portal' ? 'hidden md:block' : 'block'}`}>
      {/* Top Banner com Marca, Módulo Atual, Utilizador e Ações Globais */}
      <div className="px-2.5 sm:px-5 py-2 flex items-center justify-between gap-1.5 sm:gap-3 border-b border-stone-800/80">
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          {/* Logo & Marca */}
          <button
            onClick={() => onSelectModule('portal')}
            className="flex items-center gap-2 text-left group focus:outline-none shrink-0"
            title="Ir para o Portal Geral de Módulos"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-600 via-orange-600 to-rose-700 flex items-center justify-center shadow-lg shadow-orange-950/40 text-white font-extrabold text-base sm:text-lg border border-amber-500/30 group-hover:scale-105 transition-transform shrink-0">
              S&N
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold tracking-tight text-white text-sm sm:text-base">
                  Sabores & Nações
                </span>
                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  PT
                </span>
              </div>
              <div className="text-[10px] text-stone-400">
                Sistema Integrado de POS
              </div>
            </div>
          </button>

          {/* Seletor Dropdown do Módulo Atual */}
          <div className="relative">
            <button
              onClick={() => setModuleDropdownOpen(!moduleDropdownOpen)}
              className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1.5 bg-stone-900 hover:bg-stone-800 rounded-xl border border-stone-700/80 text-[11px] sm:text-xs font-bold transition-all shadow-sm max-w-[140px] sm:max-w-none"
              title={isAdminOrManager ? "Alternar módulo" : "Módulo em execução"}
            >
              <CurrentIcon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${moduleMeta[currentModule].color}`} />
              <span className="text-white truncate">{moduleMeta[currentModule].label}</span>
              {isAdminOrManager ? (
                <ChevronDown className="w-3 h-3 text-stone-400 ml-0.5 shrink-0" />
              ) : (
                <span className="text-[9px] text-stone-400 font-normal hidden lg:inline">• Individual</span>
              )}
            </button>

            {/* Menu Dropdown de Módulos (com permissões) */}
            {moduleDropdownOpen && (
              <div className="absolute left-0 mt-1.5 w-60 sm:w-64 bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in py-1">
                <div className="px-3 py-2 border-b border-stone-800 text-[10px] uppercase font-bold text-stone-400 flex items-center justify-between">
                  <span>Selecionar Módulo</span>
                  {isAdminOrManager && <span className="text-purple-400">Admin</span>}
                </div>

                <button
                  onClick={() => handleSelectModuleSafe('portal')}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs transition-colors ${
                    currentModule === 'portal' ? 'bg-amber-600/20 text-amber-300 font-bold' : 'text-stone-300 hover:bg-stone-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Home className="w-4 h-4 text-stone-400" />
                    <span>Portal Geral de Acesso</span>
                  </div>
                  {currentModule === 'portal' && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
                </button>

                {(['atendimento', 'cozinha', 'bar', 'faturacao', 'admin'] as ModuleType[]).map((m) => {
                  const mData = moduleMeta[m];
                  const MIcon = mData.icon;
                  const isAuth = store.canUserAccessModule(currentUser, m);
                  const isCurrent = currentModule === m;

                  return (
                    <button
                      key={m}
                      onClick={() => handleSelectModuleSafe(m)}
                      disabled={!isAuth}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs transition-colors ${
                        isCurrent
                          ? 'bg-amber-600/20 text-amber-300 font-bold'
                          : isAuth
                          ? 'text-stone-200 hover:bg-stone-800'
                          : 'text-stone-600 bg-stone-950/40 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <MIcon className={`w-4 h-4 shrink-0 ${mData.color}`} />
                        <span className="truncate">{mData.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-1">
                        {mData.badge && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-800 text-stone-300 font-bold font-mono">
                            {mData.badge}
                          </span>
                        )}
                        {isCurrent && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Central & Direita: Teste Obrigatório, Turno, Som, Utilizador */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Cenário Obrigatório de Teste (Highlight) */}
          <button
            onClick={onOpenScenarioModal}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[11px] sm:text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 border border-emerald-400/40 shrink-0"
            title="Abrir o Cenário de Teste Obrigatório (14 Critérios)"
          >
            <PlayCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden md:inline">Cenário de Teste</span>
            <span className="md:hidden">Testes</span>
          </button>

          {/* Botão de Download Direto da Chave Pública AT (272 bytes) */}
          <button
            onClick={() => {
              const keyContent =
                '-----BEGIN PUBLIC KEY-----\n' +
                'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCmdaiJQ6FJq5aN4gqB6qzOnnDH\n' +
                'bMTXZJy/1RoAqEOZksNdV3kWO5ngXIYETj/TNjgfc2E6dSAmCuLWj04JuRvMly9D\n' +
                'V3GYzVnKKUcatQR7i+kQU3QsSFBXkMOH2RXUjmNAwxoiM9xu14sXgXFVJcP4Juyb\n' +
                'MB38EhwvlGoZkhL9twIDAQAB\n' +
                '-----END PUBLIC KEY-----\n';
              const blob = new Blob([keyContent], { type: 'text/plain;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'chave_publica.txt';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 text-[11px] sm:text-xs font-black rounded-xl shadow-md transition-all active:scale-95 border border-amber-300 shrink-0 cursor-pointer"
            title="Clique aqui para descarregar chave_publica.txt com 272 bytes exatos para o Portal das Finanças"
          >
            <Key className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Baixar Chave AT (272b)</span>
            <span className="sm:hidden">Chave AT</span>
          </button>

          {/* Toggle Online/Offline para resiliência */}
          <button
            onClick={() => store.setOnline(!isOnline)}
            className={`p-1.5 sm:px-2 sm:py-1.5 text-xs font-semibold rounded-xl border transition-colors shrink-0 ${
              isOnline
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-700/50 hover:bg-emerald-900/50'
                : 'bg-rose-950/60 text-rose-300 border-rose-600 animate-pulse'
            }`}
            title={isOnline ? 'Ligado em tempo real' : 'Modo Offline'}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-rose-400" />}
          </button>

          {/* Som on/off */}
          <button
            onClick={() =>
              store.saveSettings({
                ...store.getState().settings,
                soundAlertsEnabled: !soundEnabled,
              })
            }
            className="p-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 transition-colors shrink-0"
            title={soundEnabled ? 'Alertas sonoros ativos' : 'Alertas sonoros silenciados'}
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-stone-500" />
            )}
          </button>

          {/* Botão Discreto de Troca de Tema (Modo Claro / Modo Escuro) */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-800 transition-all active:scale-95 shrink-0"
            title={isDark ? 'Ativar Modo Claro (☀️)' : 'Ativar Modo Escuro (🌙)'}
            aria-label={isDark ? 'Ativar Modo Claro' : 'Ativar Modo Escuro'}
          >
            {isDark ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="hidden lg:inline text-xs font-semibold">Modo Claro</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="hidden lg:inline text-xs font-semibold">Modo Escuro</span>
              </>
            )}
          </button>

          {/* Botão para Copiar / Abrir Link Direto do Atendimento */}
          <button
            onClick={() => {
              const url = `${window.location.origin}/?modulo=atendimento`;
              if (navigator.clipboard) {
                navigator.clipboard.writeText(url);
              }
              alert(`Link Direto do Garçom / Atendimento:\n\n${url}\n\n(Copiado para a área de transferência! Pode abrir diretamente em qualquer telemóvel ou tablet).`);
            }}
            className="hidden sm:flex items-center gap-1 px-2 py-1.5 bg-amber-950/50 hover:bg-amber-900/70 text-amber-300 text-xs font-bold rounded-xl border border-amber-800/80 transition-all shadow-sm shrink-0"
            title="Copiar link direto para telemóvel do garçom"
          >
            <Smartphone className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden lg:inline">Link Garçom</span>
          </button>

          {/* Instalação PWA */}
          <div className="hidden sm:block shrink-0">
            <PWAInstallButton />
          </div>

          {/* Operador Ativo */}
          <button
            onClick={onOpenOperatorModal}
            className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 bg-stone-900 hover:bg-stone-800 text-stone-100 rounded-xl border border-stone-800 text-xs font-medium transition-all shrink-0 max-w-[120px] sm:max-w-[180px]"
            title="Alternar utilizador / conta individual"
          >
            <span className="text-base leading-none shrink-0">{currentUser.avatar}</span>
            <div className="text-left hidden sm:block truncate">
              <div className="font-bold text-stone-200 leading-tight truncate text-[11px] sm:text-xs">{currentUser.name}</div>
              <div className="text-[9px] text-amber-400 leading-none truncate">
                {roleLabels[currentUser.role] || currentUser.role}
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Faixa de Abas dos Módulos (Design Responsivo sem Cortes) */}
      <div className="bg-stone-950/90 px-2 sm:px-4 py-1.5 border-b border-stone-800/60 overflow-hidden">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar touch-scroll py-0.5">
          {/* Aba Portal Geral */}
          <button
            onClick={() => handleSelectModuleSafe('portal')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
              currentModule === 'portal'
                ? 'bg-stone-800 text-white shadow ring-1 ring-stone-600'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
            }`}
          >
            <Home className="w-3.5 h-3.5 text-stone-300" />
            <span>Portal Geral</span>
          </button>

          {/* Abas dos 5 Módulos Operacionais */}
          {(['atendimento', 'cozinha', 'bar', 'faturacao', 'admin'] as ModuleType[]).map((modKey) => {
            const mData = moduleMeta[modKey];
            const Icon = mData.icon;
            const isAuth = store.canUserAccessModule(currentUser, modKey);
            const isCurrent = currentModule === modKey;

            // Se o utilizador não tiver autorização e não for admin/gerente, não polui a barra
            if (!isAuth && !isAdminOrManager) return null;

            return (
              <button
                key={modKey}
                onClick={() => handleSelectModuleSafe(modKey)}
                disabled={!isAuth}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                  isCurrent
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-950/40 ring-1 ring-amber-400/50'
                    : isAuth
                    ? 'bg-stone-900/80 text-stone-300 hover:bg-stone-850 hover:text-white border border-stone-800/80'
                    : 'bg-stone-950 text-stone-600 cursor-not-allowed border border-stone-900'
                }`}
                title={!isAuth ? `Acesso restrito ao perfil de ${roleLabels[currentUser.role]}` : mData.label}
              >
                <Icon className={`w-3.5 h-3.5 ${isCurrent ? 'text-white' : mData.color}`} />
                <span>{mData.label}</span>
                {mData.badge && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-extrabold ${
                      isCurrent ? 'bg-amber-950 text-amber-200' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {mData.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Banner de Modo Offline */}
      {!isOnline && (
        <div className="bg-rose-950 text-rose-200 text-xs font-semibold px-4 py-1.5 flex items-center justify-between border-b border-rose-800 animate-pulse">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-rose-400" />
            <span>
              Modo Offline: novos pedidos e itens são salvaguardados em cache no dispositivo. Faturação certificada em pausa até restabelecimento.
            </span>
          </div>
          <button
            onClick={() => store.setOnline(true)}
            className="underline hover:text-white text-[11px] font-bold"
          >
            Reconectar
          </button>
        </div>
      )}
    </header>
  );
};

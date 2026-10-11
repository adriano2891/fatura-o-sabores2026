/**
 * Sabores & Nações - Plataforma Integrada de POS e Gestão de Restaurante em Portugal
 * 4 Módulos Independentes: Atendimento, Cozinha/Copa, Bar e Administração
 * Conforme requisitos: Ponto de Venda, Comanda Digital, Mesas, KDS, BDS, Caixa e Faturação Certificada (Vendus / AT)
 */

import React, { useState, useEffect } from 'react';
import { store, AppState } from './services/storage';
import { Navbar } from './components/Navbar';
import { OperatorModal } from './components/OperatorModal';
import { ValidationScenarioModal } from './components/ValidationScenarioModal';
import { ReceiptModal } from './components/ReceiptModal';
import { ShiftHandoverModal } from './components/ShiftHandoverModal';
import { initFirebaseRealtimeSync } from './services/firebaseRealtime';
import { PortalView } from './views/PortalView';
import { WaiterView } from './views/WaiterView';
import { KitchenView } from './views/KitchenView';
import { BarView } from './views/BarView';
import { AdminHubView } from './views/AdminHubView';
import { InvoicingPageView } from './views/InvoicingPageView';
import { PublicInvoiceView } from './views/PublicInvoiceView';
import { ModuleType, FiscalDocument, User } from './types';
import {
  UtensilsCrossed,
  Flame,
  Wine,
  ShieldCheck,
  Home,
  ShieldAlert,
  FileCheck2,
} from 'lucide-react';

export default function App() {
  // Obter módulo e sub-aba inicial a partir dos parâmetros de URL (?modulo=admin&subtab=operacional)
  const getInitialRoutingFromUrl = (): { module: ModuleType | 'portal'; subTab: string } => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash.toLowerCase().replace('#', '');
      const paramMod =
        searchParams.get('modulo') ||
        searchParams.get('module') ||
        searchParams.get('page') ||
        searchParams.get('tab') ||
        hash;

      const rawSubTab =
        searchParams.get('subtab') ||
        searchParams.get('subTab') ||
        searchParams.get('sub_tab') ||
        searchParams.get('aba');

      let targetModule: ModuleType | 'portal' = 'portal';
      if (paramMod === 'atendimento' || paramMod === 'garcom' || paramMod === 'mesas') targetModule = 'atendimento';
      else if (paramMod === 'cozinha' || paramMod === 'kitchen' || paramMod === 'kds') targetModule = 'cozinha';
      else if (paramMod === 'bar' || paramMod === 'bds') targetModule = 'bar';
      else if (paramMod === 'faturacao' || paramMod === 'faturas' || paramMod === 'invoices') targetModule = 'faturacao';
      else if (paramMod === 'admin' || paramMod === 'administracao') targetModule = 'admin';
      else if (paramMod === 'portal') targetModule = 'portal';

      let targetSubTab = 'dashboard';
      if (rawSubTab) {
        const lower = rawSubTab.toLowerCase();
        if (
          lower === 'operacional' ||
          lower === 'mesas' ||
          lower === 'atendimento' ||
          lower === 'garcom' ||
          lower === 'espelho'
        ) {
          targetSubTab = 'operacional';
        } else if (lower === 'caixa' || lower === 'pos' || lower === 'pagamentos' || lower === 'cashier') {
          targetSubTab = 'caixa';
        } else if (lower === 'vendas' || lower === 'sales' || lower === 'historico_vendas') {
          targetSubTab = 'vendas';
        } else if (lower === 'cozinha' || lower === 'copa' || lower === 'kitchen' || lower === 'kds') {
          targetSubTab = 'cozinha';
        } else {
          targetSubTab = lower;
        }
      }

      return { module: targetModule, subTab: targetSubTab };
    } catch (e) {
      console.error('Erro ao ler URL param', e);
      return { module: 'portal', subTab: 'dashboard' };
    }
  };

  // Deteta se o utilizador está a aceder a um link público de fatura (/fatura/:token ou ?token=...)
  const checkPublicInvoiceToken = (): string | null => {
    try {
      const path = window.location.pathname;
      const searchParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash.replace('#', '');

      if (searchParams.get('token')) return searchParams.get('token');
      if (searchParams.get('fatura')) return searchParams.get('fatura');
      if (searchParams.get('t')) return searchParams.get('t');

      if (path.startsWith('/fatura/')) {
        const segs = path.split('/').filter(Boolean);
        if (segs.length >= 2) return segs[1];
      }
      if (hash.startsWith('fatura/')) {
        const segs = hash.split('/').filter(Boolean);
        if (segs.length >= 2) return segs[1];
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  };

  const initialRouting = getInitialRoutingFromUrl();
  const [publicInvoiceToken, setPublicInvoiceToken] = useState<string | null>(() => checkPublicInvoiceToken());
  const [currentModule, setCurrentModule] = useState<ModuleType | 'portal'>(initialRouting.module);
  const [adminSubTab, setAdminSubTab] = useState<string>(initialRouting.subTab);
  const [state, setState] = useState<AppState>(() => store.getState());

  // Modais
  const [operatorModalOpen, setOperatorModalOpen] = useState(false);
  const [scenarioModalOpen, setScenarioModalOpen] = useState(false);
  const [shiftHandoverModalOpen, setShiftHandoverModalOpen] = useState(false);
  const [activeReceiptDoc, setActiveReceiptDoc] = useState<FiscalDocument | null>(null);

  useEffect(() => {
    const unsubscribe = store.subscribe((newState) => {
      setState(newState);
    });
    const fbSync = initFirebaseRealtimeSync();

    return () => {
      unsubscribe();
      fbSync.unsubscribe?.();
    };
  }, []);

  // Sincroniza a URL com o módulo e sub-aba ativos para permitir link direto, recarregamento e favoritos
  useEffect(() => {
    if (publicInvoiceToken) return; // Preserva o endereço limpo /fatura/:token
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('modulo', currentModule);
      if (currentModule === 'admin' && adminSubTab) {
        url.searchParams.set('subtab', adminSubTab);
      } else {
        url.searchParams.delete('subtab');
      }
      window.history.replaceState({}, '', url.toString());
    } catch (e) {
      console.error(e);
    }
  }, [currentModule, adminSubTab, publicInvoiceToken]);

  // Escuta alterações de histórico e hash
  useEffect(() => {
    const handleUrlChange = () => {
      const pubToken = checkPublicInvoiceToken();
      setPublicInvoiceToken(pubToken);
      if (!pubToken) {
        const routing = getInitialRoutingFromUrl();
        setCurrentModule(routing.module);
        if (routing.subTab) {
          setAdminSubTab(routing.subTab);
        }
      }
    };
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  const handleSelectModule = (mod: ModuleType | 'portal', subTab?: string) => {
    if (subTab) {
      setAdminSubTab(subTab);
    }
    if (mod === 'portal') {
      setCurrentModule('portal');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Validação estrita de autorização em tempo de execução
    if (store.canUserAccessModule(state.currentUser, mod)) {
      setCurrentModule(mod);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Bloqueio de acesso não autorizado
      alert(
        `Acesso Não Autorizado: A sua conta (${state.currentUser.name} - ${state.currentUser.role}) não tem permissão para aceder ao módulo "${mod}".`
      );
    }
  };

  const handleUserLoginSuccess = (_newUser: User) => {
    // Encaminha o utilizador para o Portal Geral de Acesso após a autenticação
    setCurrentModule('portal');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Verificação de autorização para o módulo atual
  const isAuthorizedForCurrent =
    currentModule === 'portal' ||
    store.canUserAccessModule(state.currentUser, currentModule) ||
    (currentModule === 'admin' &&
      (adminSubTab === 'operacional' ||
        adminSubTab === 'caixa' ||
        adminSubTab === 'vendas' ||
        adminSubTab === 'cozinha'));

  const isAdminOrManager =
    state.currentUser.role === 'admin' || state.currentUser.role === 'manager';

  // Badges em tempo real para navegação móvel
  const readyItemsCount = state.comandas.reduce(
    (acc, c) => acc + c.rounds.reduce((rAcc, r) => rAcc + r.items.filter((i) => i.status === 'pronto').length, 0),
    0
  );
  const kitchenPendingCount = state.comandas.reduce(
    (acc, c) =>
      acc +
      c.rounds.reduce(
        (rAcc, r) =>
          rAcc +
          r.items.filter(
            (i) => (i.sector === 'cozinha' || i.sector === 'pastelaria') && (i.status === 'recebido' || i.status === 'em_preparacao')
          ).length,
        0
      ),
    0
  );
  const barPendingCount = state.comandas.reduce(
    (acc, c) =>
      acc +
      c.rounds.reduce(
        (rAcc, r) => rAcc + r.items.filter((i) => i.sector === 'bar' && (i.status === 'recebido' || i.status === 'em_preparacao')).length,
        0
      ),
    0
  );

  // Se estiver a aceder pelo link público de fatura (WhatsApp ou Email), renderiza diretamente sem exigir login
  if (publicInvoiceToken) {
    return <PublicInvoiceView tokenFromUrl={publicInvoiceToken} />;
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans selection:bg-amber-500 selection:text-white pb-28 md:pb-8">
      {/* Top Navbar Multi-Módulo */}
      <Navbar
        currentModule={currentModule}
        onSelectModule={handleSelectModule}
        currentUser={state.currentUser}
        onOpenOperatorModal={() => setOperatorModalOpen(true)}
        onOpenScenarioModal={() => setScenarioModalOpen(true)}
        onOpenShiftHandoverModal={() => setShiftHandoverModalOpen(true)}
        tables={state.tables}
        comandas={state.comandas}
        products={state.products}
        isOnline={state.isOnline}
        soundEnabled={state.settings.soundAlertsEnabled}
      />

      {/* Main View Container */}
      <main className={`flex-1 w-full mx-auto ${
        currentModule === 'admin' &&
        (adminSubTab === 'operacional' ||
          adminSubTab === 'caixa' ||
          adminSubTab === 'vendas' ||
          adminSubTab === 'cozinha')
          ? 'max-w-full px-2 sm:px-4 py-2 sm:py-3'
          : 'max-w-7xl px-2.5 sm:px-5 md:px-6 py-2.5 sm:py-4'
      }`}>
        {!isAuthorizedForCurrent ? (
          /* Ecrã de Bloqueio de Acesso Não Autorizado */
          <div className="bg-stone-900 border border-rose-900/60 rounded-3xl p-8 max-w-md mx-auto text-center space-y-4 shadow-2xl mt-12">
            <div className="w-14 h-14 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/30">
              <ShieldAlert className="w-7 h-7 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Acesso Restrito ao Módulo</h2>
              <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                A sua conta individual ({state.currentUser.name} — <strong className="capitalize">{state.currentUser.role}</strong>)
                não possui permissões para visualizar este módulo.
              </p>
            </div>
            <div className="pt-2 space-y-2">
              <button
                onClick={() => {
                  const waiter = state.users.find((u) => u.role === 'waiter') || state.users[0];
                  store.setCurrentUser(waiter);
                  setCurrentModule('atendimento');
                }}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <span>🤵</span> Entrar como Garçom (João Pereira)
              </button>
              <button
                onClick={() => handleSelectModule(store.getDefaultModuleForUser(state.currentUser))}
                className="w-full py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold text-xs rounded-xl transition-all"
              >
                Ir para o Meu Módulo Autorizado ({state.currentUser.role})
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 1. Portal Geral de Módulos */}
            {currentModule === 'portal' && (
              <PortalView
                state={state}
                onSelectModule={handleSelectModule}
                onOpenOperatorModal={() => setOperatorModalOpen(true)}
                onOpenScenarioModal={() => setScenarioModalOpen(true)}
              />
            )}

            {/* 2. Módulo Atendimento (Empregado de Mesa) */}
            {currentModule === 'atendimento' && (
              <WaiterView
                state={state}
                onSelectTab={(tab) => {
                  if (tab === 'mesas') handleSelectModule('atendimento');
                  else if (tab === 'cozinha') handleSelectModule('cozinha');
                  else if (tab === 'caixa' || tab === 'painel') handleSelectModule('admin');
                }}
              />
            )}

            {/* 3. Módulo Cozinha / Copa */}
            {currentModule === 'cozinha' && (
              <KitchenView
                state={state}
                onSelectTab={(tab) => {
                  if (tab === 'atendimento') handleSelectModule('atendimento');
                  else if (tab === 'bar') handleSelectModule('bar');
                  else if (tab === 'painel') handleSelectModule('admin');
                }}
              />
            )}

            {/* 4. Módulo Bar */}
            {currentModule === 'bar' && (
              <BarView
                state={state}
                onSelectTab={(tab) => {
                  if (tab === 'atendimento') handleSelectModule('atendimento');
                  else if (tab === 'cozinha') handleSelectModule('cozinha');
                  else if (tab === 'painel') handleSelectModule('admin');
                }}
              />
            )}

            {/* 5. Módulo Administração */}
            {currentModule === 'admin' && (
              <AdminHubView
                state={state}
                initialSubTab={adminSubTab as any}
                onSubTabChange={(tab) => setAdminSubTab(tab)}
                onViewReceipt={(doc) => setActiveReceiptDoc(doc)}
                onSwitchModule={handleSelectModule}
              />
            )}

            {/* 6. Módulo Faturação e Emissão de Notas */}
            {currentModule === 'faturacao' && (
              <InvoicingPageView
                state={state}
                onViewReceipt={(doc) => setActiveReceiptDoc(doc)}
                onSwitchModule={handleSelectModule}
              />
            )}
          </>
        )}
      </main>

      {/* Barra de Navegação Rápida no Fundo para Dispositivos Móveis / Tablets */}
      <nav className="fixed bottom-0 inset-x-0 bg-stone-950/95 backdrop-blur-md border-t border-stone-800/90 z-30 md:hidden flex justify-around items-center px-1 py-1 pb-safe no-print shadow-2xl">
        {isAdminOrManager ? (
          <>
            <button
              onClick={() => handleSelectModule('portal')}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all min-w-0 ${
                currentModule === 'portal'
                  ? 'text-amber-400 font-extrabold bg-stone-900/60'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Home className="w-4 h-4" />
              <span className="text-[9px] sm:text-[10px] truncate w-full text-center mt-0.5">Portal</span>
            </button>

            <button
              onClick={() => handleSelectModule('atendimento')}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all min-w-0 relative ${
                currentModule === 'atendimento'
                  ? 'text-amber-400 font-extrabold bg-amber-500/10'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <div className="relative">
                <UtensilsCrossed className="w-4 h-4" />
                {readyItemsCount > 0 && (
                  <span className="absolute -top-1 -right-2.5 w-2 h-2 bg-amber-500 rounded-full animate-ping" />
                )}
              </div>
              <span className="text-[9px] sm:text-[10px] truncate w-full text-center mt-0.5">Mesas</span>
            </button>

            <button
              onClick={() => handleSelectModule('cozinha')}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all min-w-0 relative ${
                currentModule === 'cozinha'
                  ? 'text-orange-400 font-extrabold bg-orange-500/10'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <div className="relative">
                <Flame className="w-4 h-4" />
                {kitchenPendingCount > 0 && (
                  <span className="absolute -top-1 -right-2.5 w-2 h-2 bg-orange-500 rounded-full animate-ping" />
                )}
              </div>
              <span className="text-[9px] sm:text-[10px] truncate w-full text-center mt-0.5">Cozinha</span>
            </button>

            <button
              onClick={() => handleSelectModule('bar')}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all min-w-0 relative ${
                currentModule === 'bar'
                  ? 'text-cyan-400 font-extrabold bg-cyan-500/10'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <div className="relative">
                <Wine className="w-4 h-4" />
                {barPendingCount > 0 && (
                  <span className="absolute -top-1 -right-2.5 w-2 h-2 bg-cyan-500 rounded-full animate-ping" />
                )}
              </div>
              <span className="text-[9px] sm:text-[10px] truncate w-full text-center mt-0.5">Bar</span>
            </button>

            <button
              onClick={() => handleSelectModule('faturacao')}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all min-w-0 relative ${
                currentModule === 'faturacao'
                  ? 'text-emerald-400 font-extrabold bg-emerald-500/10'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <FileCheck2 className="w-4 h-4" />
              <span className="text-[9px] sm:text-[10px] truncate w-full text-center mt-0.5">Faturação</span>
            </button>

            <button
              onClick={() => handleSelectModule('admin')}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all min-w-0 ${
                currentModule === 'admin'
                  ? 'text-purple-400 font-extrabold bg-purple-500/10'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[9px] sm:text-[10px] truncate w-full text-center mt-0.5">Admin</span>
            </button>
          </>
        ) : (
          /* Navegação personalizada para a função do utilizador */
          <>
            <button
              onClick={() => handleSelectModule('portal')}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all min-w-0 ${
                currentModule === 'portal' ? 'text-amber-400 font-bold' : 'text-stone-400'
              }`}
            >
              <Home className="w-4 h-4" />
              <span className="text-[9px] sm:text-[10px] truncate w-full text-center mt-0.5">Portal</span>
            </button>

            {state.currentUser.role === 'waiter' && (
              <>
                <button
                  onClick={() => handleSelectModule('atendimento')}
                  className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all min-w-0 ${
                    currentModule === 'atendimento' ? 'text-amber-400 font-bold bg-amber-500/10' : 'text-stone-400'
                  }`}
                >
                  <UtensilsCrossed className="w-4 h-4" />
                  <span className="text-[9px] sm:text-[10px] truncate w-full text-center mt-0.5">Comandas</span>
                </button>
                <button
                  onClick={() => setShiftHandoverModalOpen(true)}
                  className="flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all min-w-0 text-stone-400 hover:text-white"
                >
                  <span className="text-sm">🔄</span>
                  <span className="text-[9px] sm:text-[10px] truncate w-full text-center mt-0.5">Turno</span>
                </button>
              </>
            )}

            {state.currentUser.role === 'kitchen' && (
              <button
                onClick={() => handleSelectModule('cozinha')}
                className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all min-w-0 ${
                  currentModule === 'cozinha' ? 'text-orange-400 font-bold bg-orange-500/10' : 'text-stone-400'
                }`}
              >
                <Flame className="w-4 h-4" />
                <span className="text-[9px] sm:text-[10px] truncate w-full text-center mt-0.5">Cozinha KDS</span>
              </button>
            )}

            {state.currentUser.role === 'bar' && (
              <button
                onClick={() => handleSelectModule('bar')}
                className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all min-w-0 ${
                  currentModule === 'bar' ? 'text-cyan-400 font-bold bg-cyan-500/10' : 'text-stone-400'
                }`}
              >
                <Wine className="w-4 h-4" />
                <span className="text-[9px] sm:text-[10px] truncate w-full text-center mt-0.5">Bar BDS</span>
              </button>
            )}

            {state.currentUser.role === 'cashier' && (
              <button
                onClick={() => handleSelectModule('admin')}
                className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all min-w-0 ${
                  currentModule === 'admin' ? 'text-purple-400 font-bold bg-purple-500/10' : 'text-stone-400'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span className="text-[9px] sm:text-[10px] truncate w-full text-center mt-0.5">Caixa</span>
              </button>
            )}

            <button
              onClick={() => setOperatorModalOpen(true)}
              className="flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all min-w-0 text-stone-400 hover:text-white"
            >
              <span className="text-sm leading-none">{state.currentUser.avatar}</span>
              <span className="text-[9px] sm:text-[10px] truncate w-full text-center mt-0.5">Operador</span>
            </button>
          </>
        )}
      </nav>

      {/* Modal de Troca de Operador */}
      <OperatorModal
        isOpen={operatorModalOpen}
        onClose={() => setOperatorModalOpen(false)}
        currentUser={state.currentUser}
        users={state.users}
        onLoginSuccess={handleUserLoginSuccess}
      />

      {/* Modal de Demonstração do Cenário Obrigatório (14 Critérios) */}
      <ValidationScenarioModal
        isOpen={scenarioModalOpen}
        onClose={() => setScenarioModalOpen(false)}
        state={state}
        onSelectModule={handleSelectModule}
        onViewReceipt={(doc) => setActiveReceiptDoc(doc)}
      />

      {/* Modal de Impressão e Visualização do Recibo Certificado */}
      <ReceiptModal
        document={activeReceiptDoc}
        settings={state.settings}
        currentUser={state.currentUser}
        onClose={() => setActiveReceiptDoc(null)}
      />

      {/* Modal de Passagem de Turno */}
      <ShiftHandoverModal
        isOpen={shiftHandoverModalOpen}
        onClose={() => setShiftHandoverModalOpen(false)}
        state={state}
      />
    </div>
  );
}

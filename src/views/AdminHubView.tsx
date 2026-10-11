import React, { useState } from 'react';
import {
  LayoutDashboard,
  FileCheck2,
  Wallet,
  Receipt,
  Grid3X3,
  BookOpen,
  Users,
  Boxes,
  BarChart3,
  Settings,
  Flame,
  Wine,
  Globe,
  Plus,
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
  UtensilsCrossed,
  RefreshCw,
} from 'lucide-react';
import { AppState, store } from '../services/storage';
import { FiscalDocument, ModuleType } from '../types';
import { formatCurrency, formatTime } from '../utils/formatters';
import { DashboardView } from './DashboardView';
import { InvoicingPageView } from './InvoicingPageView';
import { CashierView } from './CashierView';
import { SalesView } from './SalesView';
import { TablesView } from './TablesView';
import { WaiterView } from './WaiterView';
import { MenuView } from './MenuView';
import { CustomersView } from './CustomersView';
import { UsersView } from './UsersView';
import { StockView } from './StockView';
import { ReportsView } from './ReportsView';
import { SettingsView } from './SettingsView';
import { OnlineOrdersView } from './OnlineOrdersView';
import { AdHocInvoiceModal } from '../components/AdHocInvoiceModal';
import { KitchenView } from './KitchenView';

export type AdminSubTab =
  | 'dashboard'
  | 'faturacao'
  | 'caixa'
  | 'vendas'
  | 'operacional'
  | 'cozinha'
  | 'pedidos_site'
  | 'cardapio'
  | 'clientes'
  | 'utilizadores'
  | 'stock'
  | 'relatorios'
  | 'definicoes';

interface AdminHubViewProps {
  state: AppState;
  onViewReceipt: (doc: FiscalDocument) => void;
  onSwitchModule: (module: ModuleType) => void;
  initialSubTab?: AdminSubTab;
  onSubTabChange?: (tab: AdminSubTab) => void;
}

export const AdminHubView: React.FC<AdminHubViewProps> = ({
  state,
  onViewReceipt,
  onSwitchModule,
  initialSubTab = 'dashboard',
  onSubTabChange,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<AdminSubTab>(initialSubTab);

  React.useEffect(() => {
    if (initialSubTab && initialSubTab !== activeSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const handleSelectSubTab = (tab: AdminSubTab) => {
    setActiveSubTab(tab);
    onSubTabChange?.(tab);
  };

  const [adHocModalOpen, setAdHocModalOpen] = useState(false);

  const { comandas, sales, fiscalDocuments, onlineOrders, settings, isOnline } = state;

  // Badges e contadores
  const pendingInvoicesCount = sales.filter((s) => s.status === 'paga' && s.fiscalStatus !== 'faturado').length;
  const requestedBillsCount = comandas.filter((c) => c.status === 'conta_solicitada').length;
  const pendingSiteOrders = onlineOrders.filter((o) => o.prepStatus !== 'entregue').length;

  const navCategories = [
    {
      group: 'Financeiro & Controlo',
      items: [
        { id: 'dashboard' as AdminSubTab, label: 'Painel Geral', icon: LayoutDashboard },
        {
          id: 'faturacao' as AdminSubTab,
          label: 'Faturação',
          icon: FileCheck2,
          badge: pendingInvoicesCount > 0 ? `${pendingInvoicesCount}` : undefined,
          badgeColor: 'bg-amber-600 text-white',
        },
        {
          id: 'caixa' as AdminSubTab,
          label: 'Caixa & Pagamentos',
          icon: Wallet,
          badge: requestedBillsCount > 0 ? `Conta!` : undefined,
          badgeColor: 'bg-orange-500 text-white animate-bounce',
        },
        { id: 'vendas' as AdminSubTab, label: 'Gestão de Vendas', icon: Receipt },
      ],
    },
    {
      group: 'Operações & Salas',
      items: [
        {
          id: 'operacional' as AdminSubTab,
          label: 'Espelho Atendimento / Garçom',
          icon: UtensilsCrossed,
          badge: state.tables.filter((t) => t.status === 'ocupada' || t.status === 'conta_solicitada').length > 0
            ? `${state.tables.filter((t) => t.status === 'ocupada' || t.status === 'conta_solicitada').length} mesas`
            : undefined,
          badgeColor: 'bg-amber-600 text-white',
        },
        {
          id: 'pedidos_site' as AdminSubTab,
          label: 'Pedidos do Site',
          icon: Globe,
          badge: pendingSiteOrders > 0 ? `${pendingSiteOrders}` : undefined,
          badgeColor: 'bg-cyan-600 text-white',
        },
      ],
    },
    {
      group: 'Cadastros & Equipa',
      items: [
        { id: 'cardapio' as AdminSubTab, label: 'Cardápio & Setores', icon: BookOpen },
        { id: 'clientes' as AdminSubTab, label: 'Clientes & Planos', icon: Users },
        { id: 'utilizadores' as AdminSubTab, label: 'Utilizadores & Permissões', icon: Shield },
        { id: 'stock' as AdminSubTab, label: 'Stock & Inventário', icon: Boxes },
      ],
    },
    {
      group: 'Estratégia & Sistema',
      items: [
        { id: 'relatorios' as AdminSubTab, label: 'Relatórios', icon: BarChart3 },
        { id: 'definicoes' as AdminSubTab, label: 'Definições & Fisco', icon: Settings },
      ],
    },
  ];

  // 1. Caso especial: Espelho Operacional do Atendimento / Garçom em Tela Cheia e sem cortes
  if (activeSubTab === 'operacional') {
    return (
      <div className="w-full h-full flex flex-col space-y-3 animate-in fade-in duration-200">
        {/* Barra Superior do Espelho Operacional (Compacta, sem poluição administrativa desnecessária) */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center font-bold shrink-0">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-black text-white tracking-tight">
                  Espelho Operacional do Atendimento / Garçom
                </h1>
                <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full font-bold uppercase flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Sincronizado em Tempo Real
                </span>
                <span className="text-[10px] bg-stone-800 text-stone-300 border border-stone-700 px-2 py-0.5 rounded-full font-bold font-mono">
                  {state.tables.length} Mesas • {state.comandas.filter((c) => c.status === 'aberta' || c.status === 'conta_solicitada').length} Ativas
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Visualização operacional em tempo real sincronizada diretamente com os garçons, cozinha e caixa.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => handleSelectSubTab('dashboard')}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-xl border border-stone-700 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-stone-400" />
              <span>Painel Geral</span>
            </button>
            <button
              onClick={() => handleSelectSubTab('caixa')}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-xl border border-stone-700 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Wallet className="w-3.5 h-3.5 text-stone-400" />
              <span>Caixa</span>
            </button>
            <button
              onClick={() => handleSelectSubTab('faturacao')}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-xl border border-stone-700 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <FileCheck2 className="w-3.5 h-3.5 text-stone-400" />
              <span>Faturação</span>
            </button>
          </div>
        </div>

        {/* Verificação e Proteção de Dados: Evita tela vazia aguardando inicialização do estado */}
        {!state || !state.tables || state.tables.length === 0 ? (
          <div className="w-full min-h-[450px] flex flex-col items-center justify-center p-8 bg-stone-900 rounded-3xl border border-stone-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 animate-spin">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div className="text-sm font-bold text-white">A carregar Espelho Operacional...</div>
            <div className="text-xs text-stone-400">Sincronizando mesas, salas e comandas em tempo real.</div>
          </div>
        ) : (
          /* O Espelho Operacional: Ocupa 100% da largura útil sem cortes e perfeitamente responsivo */
          <div className="w-full flex-1">
            <WaiterView
              state={state}
              onSelectTab={(tab) => {
                if (tab === 'mesas') handleSelectSubTab('operacional');
                else if (tab === 'cozinha') onSwitchModule('cozinha');
                else if (tab === 'caixa') handleSelectSubTab('caixa');
                else if (tab === 'painel') handleSelectSubTab('dashboard');
              }}
            />
          </div>
        )}

        {/* Modal Faturação Avulsa */}
        <AdHocInvoiceModal
          isOpen={adHocModalOpen}
          onClose={() => setAdHocModalOpen(false)}
          state={state}
          onViewReceipt={(doc) => onViewReceipt(doc)}
        />
      </div>
    );
  }

  // 2. Caso especial: Espelho Operacional do Caixa em Tela Cheia e sem cortes
  if (activeSubTab === 'caixa') {
    const currentSession = state.cashSessions.find(
      (s) => s.id === state.currentCashSessionId && s.status === 'aberto'
    );
    const requestedBillsCount = state.comandas.filter((c) => c.status === 'conta_solicitada').length;
    const todaySales = state.sales.filter((s) => s.status === 'paga');
    const todaySalesTotal = todaySales.reduce((acc, s) => acc + s.total, 0);

    return (
      <div className="w-full h-full flex flex-col space-y-3 animate-in fade-in duration-200">
        {/* Barra Superior do Espelho do Caixa (Compacta, sem poluição administrativa desnecessária) */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center font-bold shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-black text-white tracking-tight">
                  Espelho Operacional do Caixa & Pagamentos
                </h1>
                {currentSession ? (
                  <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2.5 py-0.5 rounded-full font-bold uppercase flex items-center gap-1 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Caixa Aberto ({currentSession.id})
                  </span>
                ) : (
                  <span className="text-[10px] bg-rose-950 text-rose-400 border border-rose-800 px-2.5 py-0.5 rounded-full font-bold uppercase flex items-center gap-1 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    Caixa Fechado
                  </span>
                )}
                {requestedBillsCount > 0 && (
                  <span className="text-[10px] bg-orange-950 text-orange-400 border border-orange-700 px-2 py-0.5 rounded-full font-bold animate-pulse font-mono">
                    {requestedBillsCount} {requestedBillsCount === 1 ? 'Conta Solicitada' : 'Contas Solicitadas'}!
                  </span>
                )}
              </div>
              <div className="text-xs text-stone-400 mt-0.5 flex items-center gap-2 flex-wrap">
                {currentSession ? (
                  <>
                    <span>Operador: <strong className="text-stone-200">{currentSession.openedByName}</strong></span>
                    <span>•</span>
                    <span>Abertura: <strong className="text-stone-200">{formatTime(currentSession.openedAt)}</strong></span>
                    <span>•</span>
                    <span>Gaveta: <strong className="text-emerald-400 font-mono">{formatCurrency(currentSession.currentFloat)}</strong></span>
                    <span>•</span>
                    <span>Vendas Hoje: <strong className="text-amber-400 font-mono">{formatCurrency(todaySalesTotal)}</strong></span>
                  </>
                ) : (
                  <span>Sessão de caixa encerrada. Abra o caixa para iniciar o registo de pagamentos.</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => handleSelectSubTab('dashboard')}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-xl border border-stone-700 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-stone-400" />
              <span>Painel Geral</span>
            </button>
            <button
              onClick={() => handleSelectSubTab('operacional')}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-xl border border-stone-700 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <UtensilsCrossed className="w-3.5 h-3.5 text-stone-400" />
              <span>Mesas / Garçom</span>
            </button>
            <button
              onClick={() => handleSelectSubTab('faturacao')}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-xl border border-stone-700 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <FileCheck2 className="w-3.5 h-3.5 text-stone-400" />
              <span>Faturação</span>
            </button>
          </div>
        </div>

        {/* Verificação e Proteção de Dados: Evita tela vazia */}
        {!state || !state.cashSessions ? (
          <div className="w-full min-h-[450px] flex flex-col items-center justify-center p-8 bg-stone-900 rounded-3xl border border-stone-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 animate-spin">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div className="text-sm font-bold text-white">A carregar Espelho do Caixa...</div>
            <div className="text-xs text-stone-400">Sincronizando sessões, pagamentos e comandas em tempo real.</div>
          </div>
        ) : (
          /* O Espelho do Caixa: Ocupa 100% da largura útil sem cortes e com total responsividade */
          <div className="w-full flex-1">
            <CashierView
              state={state}
              onViewReceipt={onViewReceipt}
              onSelectTab={(tab) => {
                if (tab === 'faturas') handleSelectSubTab('faturacao');
                else if (tab === 'painel') handleSelectSubTab('dashboard');
                else if (tab === 'mesas') handleSelectSubTab('operacional');
              }}
            />
          </div>
        )}
      </div>
    );
  }

  // 3. Caso especial: Espelho Operacional de Vendas em Tela Cheia e sem cortes
  if (activeSubTab === 'vendas') {
    const totalVendido = state.sales.filter((s) => s.status === 'paga').reduce((sum, s) => sum + s.total, 0);
    const totalVendasPagas = state.sales.filter((s) => s.status === 'paga').length;
    const ticketMedio = totalVendasPagas > 0 ? totalVendido / totalVendasPagas : 0;

    return (
      <div className="w-full h-full flex flex-col space-y-3 animate-in fade-in duration-200">
        {/* Barra Superior do Espelho de Vendas (Compacta, sem poluição administrativa) */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center font-bold shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-black text-white tracking-tight">
                  Espelho Operacional de Vendas
                </h1>
                <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2.5 py-0.5 rounded-full font-bold uppercase flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Sincronizado em Tempo Real
                </span>
                <span className="text-[10px] bg-stone-800 text-stone-300 border border-stone-700 px-2 py-0.5 rounded-full font-bold font-mono">
                  {state.sales.length} Vendas Registadas
                </span>
              </div>
              <div className="text-xs text-stone-400 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>Total Faturado: <strong className="text-emerald-400 font-mono">{formatCurrency(totalVendido)}</strong></span>
                <span>•</span>
                <span>Pagas: <strong className="text-stone-200">{totalVendasPagas}</strong></span>
                <span>•</span>
                <span>Ticket Médio: <strong className="text-amber-400 font-mono">{formatCurrency(ticketMedio)}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => handleSelectSubTab('dashboard')}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-xl border border-stone-700 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-stone-400" />
              <span>Painel Geral</span>
            </button>
            <button
              onClick={() => handleSelectSubTab('caixa')}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-xl border border-stone-700 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Wallet className="w-3.5 h-3.5 text-stone-400" />
              <span>Caixa</span>
            </button>
            <button
              onClick={() => handleSelectSubTab('operacional')}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-xl border border-stone-700 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <UtensilsCrossed className="w-3.5 h-3.5 text-stone-400" />
              <span>Mesas / Garçom</span>
            </button>
            <button
              onClick={() => handleSelectSubTab('faturacao')}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-xl border border-stone-700 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <FileCheck2 className="w-3.5 h-3.5 text-stone-400" />
              <span>Faturação</span>
            </button>
          </div>
        </div>

        {/* Verificação e Proteção de Dados: Evita tela vazia */}
        {!state || !state.sales ? (
          <div className="w-full min-h-[450px] flex flex-col items-center justify-center p-8 bg-stone-900 rounded-3xl border border-stone-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 animate-spin">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div className="text-sm font-bold text-white">A carregar Espelho de Vendas...</div>
            <div className="text-xs text-stone-400">Sincronizando faturas, comandas e pagamentos em tempo real.</div>
          </div>
        ) : (
          /* O Espelho de Vendas: Ocupa 100% da largura útil sem cortes e com total responsividade */
          <div className="w-full flex-1">
            <SalesView
              state={state}
              onViewReceipt={onViewReceipt}
              onSelectTab={(tab) => {
                if (tab === 'faturas') handleSelectSubTab('faturacao');
                else if (tab === 'caixa') handleSelectSubTab('caixa');
                else if (tab === 'painel') handleSelectSubTab('dashboard');
                else if (tab === 'mesas') handleSelectSubTab('operacional');
              }}
            />
          </div>
        )}
      </div>
    );
  }

  // 4. Caso especial: Espelho Operacional da Cozinha & Copa em Tela Cheia e sem cortes
  if (activeSubTab === 'cozinha') {
    const kitchenPendingCount = state.comandas.reduce(
      (acc, c) =>
        acc +
        c.rounds.reduce(
          (rAcc, r) =>
            rAcc +
            r.items.filter(
              (i) =>
                (i.sector === 'cozinha' || i.sector === 'pastelaria' || i.sector === 'bar') &&
                (i.status === 'recebido' || i.status === 'em_preparacao')
            ).length,
          0
        ),
      0
    );

    const kitchenReadyCount = state.comandas.reduce(
      (acc, c) =>
        acc +
        c.rounds.reduce(
          (rAcc, r) =>
            rAcc +
            r.items.filter(
              (i) =>
                (i.sector === 'cozinha' || i.sector === 'pastelaria' || i.sector === 'bar') &&
                i.status === 'pronto'
            ).length,
          0
        ),
      0
    );

    return (
      <div className="w-full h-full flex flex-col space-y-3 animate-in fade-in duration-200">
        {/* Barra Superior do Espelho de Cozinha & Copa (Compacta, sem poluição administrativa) */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-500 flex items-center justify-center font-bold shrink-0">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-black text-white tracking-tight">
                  Espelho Operacional da Cozinha & Copa (KDS)
                </h1>
                <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2.5 py-0.5 rounded-full font-bold uppercase flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Sincronizado em Tempo Real
                </span>
                <span className="text-[10px] bg-stone-800 text-stone-300 border border-stone-700 px-2 py-0.5 rounded-full font-bold font-mono">
                  {kitchenPendingCount} Itens Pendentes • {kitchenReadyCount} Prontos
                </span>
              </div>
              <div className="text-xs text-stone-400 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>Visualização em tempo real de pedidos de comida, pastelaria e copa/bebidas com controlo por item.</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => handleSelectSubTab('dashboard')}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-xl border border-stone-700 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-stone-400" />
              <span>Painel Geral</span>
            </button>
            <button
              onClick={() => handleSelectSubTab('operacional')}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-xl border border-stone-700 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <UtensilsCrossed className="w-3.5 h-3.5 text-stone-400" />
              <span>Mesas / Garçom</span>
            </button>
            <button
              onClick={() => handleSelectSubTab('caixa')}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-xl border border-stone-700 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Wallet className="w-3.5 h-3.5 text-stone-400" />
              <span>Caixa</span>
            </button>
            <button
              onClick={() => handleSelectSubTab('vendas')}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-xl border border-stone-700 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Receipt className="w-3.5 h-3.5 text-stone-400" />
              <span>Vendas</span>
            </button>
          </div>
        </div>

        {/* Verificação e Proteção de Dados: Evita tela vazia */}
        {!state || !state.comandas ? (
          <div className="w-full min-h-[450px] flex flex-col items-center justify-center p-8 bg-stone-900 rounded-3xl border border-stone-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 animate-spin">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div className="text-sm font-bold text-white">A carregar Espelho da Cozinha & Copa...</div>
            <div className="text-xs text-stone-400">Sincronizando comandas e pedidos em tempo real.</div>
          </div>
        ) : (
          /* O Espelho da Cozinha: Ocupa 100% da largura útil sem cortes e com total responsividade */
          <div className="w-full flex-1">
            <KitchenView
              state={state}
              onSelectTab={(tab) => {
                if (tab === 'mesas') handleSelectSubTab('operacional');
                else if (tab === 'caixa') handleSelectSubTab('caixa');
                else if (tab === 'painel') handleSelectSubTab('dashboard');
              }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3.5 sm:space-y-4 animate-in fade-in duration-300">
      {/* Banner de Alternância Rápida entre os 4 Módulos mantendo a Identificação do Administrador */}
      <div className="bg-stone-900/90 border border-purple-900/40 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2 flex-wrap">
          <Shield className="w-4 h-4 text-purple-400 shrink-0" />
          <span className="text-xs font-bold text-stone-200">
            Painel do Administrador ({state.currentUser.name})
          </span>
          <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-800/80 px-2 py-0.5 rounded-full font-mono">
            Acesso Total aos 4 Módulos
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span className="text-[10px] sm:text-[11px] text-stone-400 font-semibold mr-0.5">Módulos:</span>
          <button
            onClick={() => onSwitchModule('atendimento')}
            className="px-2.5 py-1 bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-800/80 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Ir para o módulo Atendimento com sessão de Administrador"
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>Atendimento</span>
          </button>
          <button
            onClick={() => onSwitchModule('cozinha')}
            className="px-2.5 py-1 bg-orange-950/60 hover:bg-orange-900/80 text-orange-300 border border-orange-800/80 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Ir para o KDS Cozinha com sessão de Administrador"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Cozinha</span>
          </button>
          <button
            onClick={() => onSwitchModule('bar')}
            className="px-2.5 py-1 bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-800/80 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Ir para o BDS Bar com sessão de Administrador"
          >
            <Wine className="w-3.5 h-3.5" />
            <span>Bar</span>
          </button>
        </div>
      </div>

      {/* Sub-navegação em Categorias da Administração */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-2.5 sm:p-3 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-1 sm:px-2 pb-2 mb-2 border-b border-stone-800/80">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse shrink-0" />
            <span className="text-xs font-extrabold text-stone-200 uppercase tracking-wider">
              Área de Gestão & Administração
            </span>
          </div>

          <div className="flex items-center gap-2 justify-between sm:justify-end">
            {/* Seletor Rápido em Dropdown para Mobile (evita ter de arrastar 12 abas no ecrã tátil) */}
            <div className="md:hidden flex-1 sm:flex-none">
              <select
                value={activeSubTab}
                onChange={(e) => handleSelectSubTab(e.target.value as AdminSubTab)}
                aria-label="Selecionar aba de administração"
                className="w-full bg-stone-950 border border-purple-700/60 text-stone-100 text-xs font-bold rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                {navCategories.map((group) => (
                  <optgroup key={group.group} label={group.group}>
                    {group.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label} {item.badge ? `(${item.badge})` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <button
              onClick={() => setAdHocModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow transition-all active:scale-95 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nova Fatura Avulsa</span>
              <span className="sm:hidden">Fatura Avulsa</span>
            </button>
          </div>
        </div>

        {/* Barra de Abas Scrollável com Suporte Tátil Fluido e Sem Cortes */}
        <div className="relative">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-scroll pb-1 pt-0.5">
            {navCategories.flatMap((cat) => cat.items).map((item) => {
              const Icon = item.icon;
              const isActive = activeSubTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectSubTab(item.id)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all relative shrink-0 ${
                    isActive
                      ? 'bg-purple-700 text-white shadow-md shadow-purple-950/40 ring-1 ring-purple-500/50'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/80 bg-stone-950/40 border border-stone-850'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full font-mono ${item.badgeColor || 'bg-stone-700 text-white'}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Renderização do Conteúdo da Sub-Aba Selecionada */}
      <div>
        {activeSubTab === 'dashboard' && (
          <DashboardView
            state={state}
            onSelectTab={(tab) => {
              if (tab === 'faturas') handleSelectSubTab('faturacao');
              else if (tab === 'caixa') handleSelectSubTab('caixa');
              else if (tab === 'vendas') handleSelectSubTab('vendas');
              else if (tab === 'mesas') handleSelectSubTab('operacional');
              else if (tab === 'pedidos_site') handleSelectSubTab('pedidos_site');
              else if (tab === 'atendimento') onSwitchModule('atendimento');
              else if (tab === 'cozinha') onSwitchModule('cozinha');
              else if (tab === 'bar') onSwitchModule('bar');
            }}
            onViewReceipt={onViewReceipt}
          />
        )}

        {activeSubTab === 'faturacao' && (
          <InvoicingPageView
            state={state}
            onViewReceipt={onViewReceipt}
            onSwitchModule={onSwitchModule}
          />
        )}

        {activeSubTab === 'pedidos_site' && (
          <OnlineOrdersView state={state} onViewReceipt={onViewReceipt} />
        )}

        {activeSubTab === 'cardapio' && <MenuView state={state} />}

        {activeSubTab === 'clientes' && <CustomersView state={state} />}

        {activeSubTab === 'utilizadores' && <UsersView state={state} />}

        {activeSubTab === 'stock' && <StockView state={state} />}

        {activeSubTab === 'relatorios' && <ReportsView state={state} />}

        {activeSubTab === 'definicoes' && <SettingsView state={state} />}
      </div>

      {/* Modal Faturação Avulsa */}
      <AdHocInvoiceModal
        isOpen={adHocModalOpen}
        onClose={() => setAdHocModalOpen(false)}
        state={state}
        onViewReceipt={(doc) => onViewReceipt(doc)}
      />
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import {
  Receipt,
  Search,
  Filter,
  FileCheck2,
  Clock,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  FileText,
  DollarSign,
  CreditCard,
  Smartphone,
  Landmark,
  Calendar,
  ChevronDown,
  ChevronUp,
  Globe,
  UtensilsCrossed,
  Sparkles,
  X,
  TrendingUp,
  Award,
} from 'lucide-react';
import { AppState, store } from '../services/storage';
import { Sale, PaymentMethod } from '../types';
import { formatCurrency, formatDateTime, formatTime } from '../utils/formatters';

interface SalesViewProps {
  state: AppState;
  onViewReceipt: (doc: any) => void;
  onSelectTab: (tab: any) => void;
}

export type SalesPeriodFilter = 'hoje' | 'ontem' | 'semana' | 'mes' | 'todos' | 'personalizado';

export const SalesView: React.FC<SalesViewProps> = ({ state, onViewReceipt, onSelectTab }) => {
  const { sales, fiscalDocuments, currentUser, users } = state;

  // Filtros de busca e estado
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState<SalesPeriodFilter>('hoje');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'paga' | 'aberta' | 'anulada'>('todos');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'todos' | PaymentMethod>('todos');
  const [operatorFilter, setOperatorFilter] = useState<string>('todos');
  const [originFilter, setOriginFilter] = useState<'todos' | 'presencial' | 'site'>('todos');

  // Controle de interface
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  // Datas de referência para filtros de período
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const sevenDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }, []);
  const currentMonthStr = useMemo(() => todayStr.slice(0, 7), [todayStr]);

  // Lista única de operadores que realizaram vendas
  const availableOperators = useMemo(() => {
    const set = new Set<string>();
    sales.forEach((s) => {
      if (s.waiterName) set.add(s.waiterName);
    });
    return Array.from(set);
  }, [sales]);

  // Vendas filtradas
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      // 1. Filtro de Período
      const saleDate = s.createdAt.slice(0, 10);
      if (periodFilter === 'hoje' && saleDate !== todayStr) return false;
      if (periodFilter === 'ontem' && saleDate !== yesterdayStr) return false;
      if (periodFilter === 'semana' && saleDate < sevenDaysAgoStr) return false;
      if (periodFilter === 'mes' && !saleDate.startsWith(currentMonthStr)) return false;
      if (periodFilter === 'personalizado') {
        if (customStartDate && saleDate < customStartDate) return false;
        if (customEndDate && saleDate > customEndDate) return false;
      }

      // 2. Filtro de Status
      if (statusFilter !== 'todos' && s.status !== statusFilter) return false;

      // 3. Filtro de Método de Pagamento
      if (paymentMethodFilter !== 'todos') {
        const hasMethod = s.payments?.some((p) => p.method === paymentMethodFilter);
        if (!hasMethod) return false;
      }

      // 4. Filtro de Operador
      if (operatorFilter !== 'todos' && s.waiterName !== operatorFilter) return false;

      // 5. Filtro de Origem
      const isOnline =
        s.tableName?.toLowerCase().includes('site') ||
        s.tableName?.toLowerCase().includes('online') ||
        s.roomName?.toLowerCase().includes('site') ||
        s.roomName?.toLowerCase().includes('online') ||
        s.roomName?.toLowerCase().includes('delivery');
      if (originFilter === 'site' && !isOnline) return false;
      if (originFilter === 'presencial' && isOnline) return false;

      // 6. Pesquisa textual (ID, Mesa, Cliente, NIF)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = s.id.toLowerCase().includes(q) || s.comandaId.toLowerCase().includes(q);
        const matchTable = s.tableName.toLowerCase().includes(q) || s.roomName.toLowerCase().includes(q);
        const matchCustomer = (s.customerName && s.customerName.toLowerCase().includes(q)) || false;
        const matchNif = (s.customerNif && s.customerNif.includes(q)) || false;
        const matchWaiter = (s.waiterName && s.waiterName.toLowerCase().includes(q)) || false;
        if (!matchId && !matchTable && !matchCustomer && !matchNif && !matchWaiter) return false;
      }

      return true;
    });
  }, [
    sales,
    periodFilter,
    todayStr,
    yesterdayStr,
    sevenDaysAgoStr,
    currentMonthStr,
    customStartDate,
    customEndDate,
    statusFilter,
    paymentMethodFilter,
    operatorFilter,
    originFilter,
    searchQuery,
  ]);

  // Cálculos de Indicadores Chave (KPIs)
  const kpis = useMemo(() => {
    const totalCount = filteredSales.length;
    const paidSales = filteredSales.filter((s) => s.status === 'paga');
    const openSales = filteredSales.filter((s) => s.status === 'aberta' || s.status === 'parcialmente_paga');
    const cancelledSales = filteredSales.filter((s) => s.status === 'anulada');

    const totalRevenue = paidSales.reduce((acc, s) => acc + s.total, 0);
    const averageTicket = paidSales.length > 0 ? totalRevenue / paidSales.length : 0;

    // Métodos de Pagamento agregados
    let cashTotal = 0;
    let cardTotal = 0;
    let mbwayTotal = 0;
    let otherTotal = 0;

    paidSales.forEach((s) => {
      s.payments?.forEach((p) => {
        if (p.method === 'dinheiro') cashTotal += p.amount;
        else if (p.method === 'cartao') cardTotal += p.amount;
        else if (p.method === 'mbway') mbwayTotal += p.amount;
        else otherTotal += p.amount;
      });
    });

    // Top 4 pratos/produtos mais pedidos
    const productCountMap: Record<string, { name: string; quantity: number; total: number }> = {};
    filteredSales.forEach((s) => {
      s.items?.forEach((it) => {
        if (!productCountMap[it.productName]) {
          productCountMap[it.productName] = { name: it.productName, quantity: 0, total: 0 };
        }
        productCountMap[it.productName].quantity += it.quantity;
        productCountMap[it.productName].total += it.totalItemPrice;
      });
    });

    const topProducts = Object.values(productCountMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 4);

    return {
      totalCount,
      paidCount: paidSales.length,
      openCount: openSales.length,
      cancelledCount: cancelledSales.length,
      totalRevenue,
      averageTicket,
      cashTotal,
      cardTotal,
      mbwayTotal,
      otherTotal,
      topProducts,
    };
  }, [filteredSales]);

  // Contagem de filtros ativos
  const activeFiltersCount =
    (periodFilter !== 'hoje' ? 1 : 0) +
    (statusFilter !== 'todos' ? 1 : 0) +
    (paymentMethodFilter !== 'todos' ? 1 : 0) +
    (operatorFilter !== 'todos' ? 1 : 0) +
    (originFilter !== 'todos' ? 1 : 0) +
    (searchQuery ? 1 : 0);

  const resetAllFilters = () => {
    setPeriodFilter('hoje');
    setStatusFilter('todos');
    setPaymentMethodFilter('todos');
    setOperatorFilter('todos');
    setOriginFilter('todos');
    setSearchQuery('');
    setCustomStartDate('');
    setCustomEndDate('');
  };

  return (
    <div className="w-full space-y-3.5 sm:space-y-4">
      {/* 1. Painel Executivo de Indicadores (KPIs) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {/* Card 1: Total Faturado */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-3 sm:p-3.5 shadow-sm flex flex-col justify-between">
          <div className="text-[10px] text-stone-400 uppercase font-bold tracking-wider flex items-center justify-between">
            <span>Faturação Total</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-1 font-mono text-base sm:text-xl font-black text-emerald-400">
            {formatCurrency(kpis.totalRevenue)}
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5 truncate">
            {kpis.paidCount} de {kpis.totalCount} vendas quitadas
          </div>
        </div>

        {/* Card 2: Quantidade de Vendas */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-3 sm:p-3.5 shadow-sm flex flex-col justify-between">
          <div className="text-[10px] text-stone-400 uppercase font-bold tracking-wider flex items-center justify-between">
            <span>Total Vendas</span>
            <Receipt className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="mt-1 font-mono text-base sm:text-xl font-black text-white">
            {kpis.totalCount}
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5 flex items-center gap-1.5 truncate">
            <span className="text-emerald-400 font-bold">{kpis.paidCount} pagas</span>
            <span>•</span>
            <span className="text-amber-400">{kpis.openCount} abertas</span>
          </div>
        </div>

        {/* Card 3: Ticket Médio */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-3 sm:p-3.5 shadow-sm flex flex-col justify-between">
          <div className="text-[10px] text-stone-400 uppercase font-bold tracking-wider flex items-center justify-between">
            <span>Ticket Médio</span>
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-1 font-mono text-base sm:text-xl font-black text-cyan-300">
            {formatCurrency(kpis.averageTicket)}
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5 truncate">
            Média por comanda liquidada
          </div>
        </div>

        {/* Card 4: Dinheiro Físico */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-3 sm:p-3.5 shadow-sm flex flex-col justify-between">
          <div className="text-[10px] text-stone-400 uppercase font-bold tracking-wider flex items-center justify-between">
            <span>Numerário / Dinheiro</span>
            <Landmark className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="mt-1 font-mono text-sm sm:text-base font-bold text-stone-200">
            {formatCurrency(kpis.cashTotal)}
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5 truncate">
            Recebido na gaveta
          </div>
        </div>

        {/* Card 5: Cartão & TPA */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-3 sm:p-3.5 shadow-sm flex flex-col justify-between">
          <div className="text-[10px] text-stone-400 uppercase font-bold tracking-wider flex items-center justify-between">
            <span>Cartão / TPA</span>
            <CreditCard className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="mt-1 font-mono text-sm sm:text-base font-bold text-stone-200">
            {formatCurrency(kpis.cardTotal)}
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5 truncate">
            Débito & Crédito
          </div>
        </div>

        {/* Card 6: MB Way & Outros */}
        <div className="bg-gradient-to-br from-amber-950/40 via-stone-900 to-stone-900 border border-amber-700/50 rounded-2xl p-3 sm:p-3.5 shadow-md flex flex-col justify-between">
          <div className="text-[10px] text-amber-400 uppercase font-bold tracking-wider flex items-center justify-between">
            <span>MB Way & Outros</span>
            <Smartphone className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-1 font-mono text-sm sm:text-base font-bold text-amber-300">
            {formatCurrency(kpis.mbwayTotal + kpis.otherTotal)}
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5 truncate">
            Digital e Transferências
          </div>
        </div>
      </div>

      {/* 2. Top Pratos / Produtos Mais Vendidos (Pills compactas) */}
      {kpis.topProducts.length > 0 && (
        <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm">
          <div className="flex items-center gap-2 shrink-0">
            <Award className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-bold text-stone-200">Mais Vendidos no Período:</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-scroll py-0.5">
            {kpis.topProducts.map((p, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 bg-stone-950/80 border border-stone-800 px-2.5 py-1 rounded-xl text-xs whitespace-nowrap shrink-0"
              >
                <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center justify-center font-mono">
                  {idx + 1}
                </span>
                <span className="font-medium text-stone-200">{p.name}</span>
                <span className="font-mono font-bold text-amber-400 text-[11px]">({p.quantity}x)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Barra de Controlo: Pesquisa e Filtros Rápidos */}
      <div className="bg-stone-900 rounded-2xl border border-stone-800 p-3 sm:p-4 space-y-3 shadow-md">
        {/* Linha Principal de Filtros */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Caixa de Pesquisa */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Pesquisar por ID da venda, comanda, mesa, cliente, NIF ou operador..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-stone-950 border border-stone-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white focus:outline-none focus:border-amber-500 w-full placeholder:text-stone-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-stone-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Seletores de Período Rápido */}
          <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-xl border border-stone-800 text-xs overflow-x-auto no-scrollbar touch-scroll shrink-0">
            {(
              [
                { id: 'hoje', label: 'Hoje' },
                { id: 'ontem', label: 'Ontem' },
                { id: 'semana', label: 'Esta Semana' },
                { id: 'mes', label: 'Este Mês' },
                { id: 'todos', label: 'Todas' },
                { id: 'personalizado', label: 'Personalizado' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setPeriodFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs whitespace-nowrap transition-all ${
                  periodFilter === tab.id
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Botão de Alternância de Filtros Avançados no Mobile e Tablet */}
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all shrink-0 ${
              activeFiltersCount > 0
                ? 'bg-amber-600/20 border-amber-600/60 text-amber-300'
                : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-white'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-stone-950 text-[10px] font-black flex items-center justify-center font-mono">
                {activeFiltersCount}
              </span>
            )}
            {showMobileFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Linha de Datas Personalizadas (Exibida se período for 'personalizado') */}
        {periodFilter === 'personalizado' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-800 text-xs text-stone-300 animate-in fade-in duration-200">
            <span className="text-stone-400 font-medium">De:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1 text-xs text-white"
            />
            <span className="text-stone-400 font-medium">Até:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1 text-xs text-white"
            />
          </div>
        )}

        {/* Painel Expansível de Filtros Avançados (Status, Forma de Pagamento, Operador, Origem) */}
        {showMobileFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-3 border-t border-stone-800 text-xs animate-in fade-in duration-200">
            {/* Filtro Status */}
            <div>
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                Estado da Venda:
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full bg-stone-950 border border-stone-800 text-stone-200 text-xs font-semibold rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
              >
                <option value="todos">Todos os Estados</option>
                <option value="paga">Paga (Concluída)</option>
                <option value="aberta">Em Aberto (Pendente)</option>
                <option value="anulada">Anulada (Cancelada)</option>
              </select>
            </div>

            {/* Filtro Forma de Pagamento */}
            <div>
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                Forma de Pagamento:
              </label>
              <select
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value as any)}
                className="w-full bg-stone-950 border border-stone-800 text-stone-200 text-xs font-semibold rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
              >
                <option value="todos">Todos os Métodos</option>
                <option value="dinheiro">Numerário / Dinheiro</option>
                <option value="cartao">Cartão de Débito / Crédito</option>
                <option value="mbway">MB Way</option>
                <option value="transferencia">Transferência Bancária</option>
              </select>
            </div>

            {/* Filtro Operador / Garçom */}
            <div>
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                Operador / Garçom:
              </label>
              <select
                value={operatorFilter}
                onChange={(e) => setOperatorFilter(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 text-stone-200 text-xs font-semibold rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
              >
                <option value="todos">Todos os Operadores</option>
                {availableOperators.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Origem */}
            <div>
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                Origem do Pedido:
              </label>
              <div className="flex items-center gap-1.5">
                <select
                  value={originFilter}
                  onChange={(e) => setOriginFilter(e.target.value as any)}
                  className="w-full bg-stone-950 border border-stone-800 text-stone-200 text-xs font-semibold rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
                >
                  <option value="todos">Todas as Origens</option>
                  <option value="presencial">Presencial (Salão / Mesas)</option>
                  <option value="site">Site / Online / Takeaway</option>
                </select>
                {activeFiltersCount > 0 && (
                  <button
                    onClick={resetAllFilters}
                    className="px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-rose-400 text-xs font-bold rounded-xl whitespace-nowrap"
                    title="Limpar todos os filtros"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Lista e Tabela de Vendas Adaptável (Desktop Table & Mobile Cards) */}
      <div className="bg-stone-900 rounded-2xl border border-stone-800 overflow-hidden shadow-xl">
        {/* Modo Desktop: Tabela Completa (hidden no mobile) */}
        <div className="hidden md:block overflow-x-auto touch-scroll">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="bg-stone-950 border-b border-stone-800 uppercase text-[10px] tracking-wider text-stone-400">
              <tr>
                <th className="px-4 py-3">ID Venda / Comanda</th>
                <th className="px-4 py-3">Mesa & Sala</th>
                <th className="px-4 py-3">Data e Hora</th>
                <th className="px-4 py-3">Operador</th>
                <th className="px-4 py-3">Cliente / NIF</th>
                <th className="px-4 py-3">Pagamento</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-center">Estado Venda</th>
                <th className="px-4 py-3 text-center">Estado Fiscal</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/80">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-stone-500 italic">
                    Nenhuma venda encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => {
                  const doc = fiscalDocuments.find((d) => d.id === sale.documentId || d.saleId === sale.id);
                  const isOnline =
                    sale.tableName?.toLowerCase().includes('site') ||
                    sale.tableName?.toLowerCase().includes('online') ||
                    sale.roomName?.toLowerCase().includes('site');

                  return (
                    <tr key={sale.id} className="hover:bg-stone-850 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-white">
                        {sale.id}
                        <div className="text-[10px] text-stone-500 font-normal">{sale.comandaId}</div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-bold text-white">
                          {isOnline ? (
                            <Globe className="w-3.5 h-3.5 text-cyan-400" />
                          ) : (
                            <UtensilsCrossed className="w-3.5 h-3.5 text-amber-500" />
                          )}
                          <span>{sale.tableName}</span>
                        </div>
                        <div className="text-[10px] text-stone-400">{sale.roomName}</div>
                      </td>

                      <td className="px-4 py-3 font-mono text-stone-400">
                        {formatDateTime(sale.createdAt)}
                      </td>

                      <td className="px-4 py-3 text-stone-300">{sale.waiterName}</td>

                      <td className="px-4 py-3">
                        <div className="text-white font-medium">{sale.customerName || 'Consumidor Final'}</div>
                        <div className="text-[10px] text-stone-400 font-mono">
                          {sale.customerNif || '999999990'}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {sale.payments && sale.payments.length > 0 ? (
                            sale.payments.map((p, pIdx) => (
                              <span
                                key={pIdx}
                                className="text-[9px] uppercase px-1.5 py-0.5 rounded font-bold font-mono bg-stone-950 border border-stone-800 text-stone-300"
                              >
                                {p.method}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-stone-500">—</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-bold text-amber-400 text-sm">
                        {formatCurrency(sale.total)}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-bold border ${
                            sale.status === 'paga'
                              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                              : sale.status === 'parcialmente_paga'
                              ? 'bg-amber-950/80 text-amber-400 border-amber-800'
                              : 'bg-stone-800 text-stone-300 border-stone-700'
                          }`}
                        >
                          {sale.status.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-bold border ${
                            sale.fiscalStatus === 'comunicada_at' || sale.fiscalStatus === 'emitida'
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                              : 'bg-stone-800 text-stone-400 border-stone-700'
                          }`}
                        >
                          {sale.fiscalStatus === 'comunicada_at'
                            ? 'Comunicada AT'
                            : sale.fiscalStatus === 'emitida'
                            ? 'Emitida'
                            : 'Não Emitida'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => setSelectedSale(sale)}
                          className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors"
                          title="Ver detalhes da venda"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {doc && (
                          <button
                            onClick={() => onViewReceipt(doc)}
                            className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 transition-colors"
                            title="Ver Fatura / Recibo Certificado"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Modo Mobile: Cards Verticais sem Cortes e com Zero Overflow Horizontal */}
        <div className="md:hidden divide-y divide-stone-800">
          {filteredSales.length === 0 ? (
            <div className="p-8 text-center text-stone-500 text-xs italic">
              Nenhuma venda encontrada com os filtros selecionados.
            </div>
          ) : (
            filteredSales.map((sale) => {
              const doc = fiscalDocuments.find((d) => d.id === sale.documentId || d.saleId === sale.id);
              const isOnline =
                sale.tableName?.toLowerCase().includes('site') ||
                sale.tableName?.toLowerCase().includes('online') ||
                sale.roomName?.toLowerCase().includes('site');

              return (
                <div key={sale.id} className="p-3.5 space-y-2.5 hover:bg-stone-850/50 transition-colors">
                  {/* Topo do Card Mobile */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {isOnline ? (
                        <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      ) : (
                        <UtensilsCrossed className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      )}
                      <span className="font-extrabold text-sm text-white">{sale.tableName}</span>
                      <span className="text-[10px] text-stone-400">({sale.roomName})</span>
                    </div>

                    <div className="font-mono font-black text-sm text-amber-400">
                      {formatCurrency(sale.total)}
                    </div>
                  </div>

                  {/* Detalhes Intermediários */}
                  <div className="flex items-center justify-between text-xs text-stone-400 flex-wrap gap-1">
                    <div>
                      ID: <span className="font-mono text-stone-200">{sale.id}</span>
                      <span className="mx-1">•</span>
                      <span>{sale.waiterName}</span>
                    </div>
                    <div className="font-mono text-[11px] text-stone-400">
                      {formatDateTime(sale.createdAt)}
                    </div>
                  </div>

                  {/* Cliente e NIF */}
                  <div className="text-xs text-stone-300 flex items-center justify-between gap-2">
                    <span className="truncate">{sale.customerName || 'Consumidor Final'}</span>
                    <span className="font-mono text-[11px] text-stone-400 shrink-0">
                      NIF: {sale.customerNif || '999999990'}
                    </span>
                  </div>

                  {/* Badges e Ações */}
                  <div className="flex items-center justify-between pt-1 gap-2 border-t border-stone-850 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-bold border ${
                          sale.status === 'paga'
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                            : 'bg-stone-800 text-stone-300 border-stone-700'
                        }`}
                      >
                        {sale.status.replace(/_/g, ' ')}
                      </span>
                      <span
                        className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-bold border ${
                          sale.fiscalStatus === 'comunicada_at' || sale.fiscalStatus === 'emitida'
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                            : 'bg-stone-800 text-stone-400 border-stone-700'
                        }`}
                      >
                        {sale.fiscalStatus === 'comunicada_at'
                          ? 'AT OK'
                          : sale.fiscalStatus === 'emitida'
                          ? 'Emitida'
                          : 'Pendente'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedSale(sale)}
                        className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-lg flex items-center gap-1 border border-stone-700"
                      >
                        <Eye className="w-3.5 h-3.5 text-stone-400" />
                        <span>Detalhes</span>
                      </button>
                      {doc && (
                        <button
                          onClick={() => onViewReceipt(doc)}
                          className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 text-xs font-semibold rounded-lg flex items-center gap-1 border border-emerald-800"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Fatura</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 5. Modal de Detalhes da Venda Completo */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-xl shadow-2xl p-5 space-y-4 text-stone-100 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-stone-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-white">Detalhes da Venda: {selectedSale.id}</h3>
                <p className="text-xs text-stone-400">
                  {selectedSale.tableName} • {selectedSale.roomName} • {formatDateTime(selectedSale.createdAt)}
                </p>
              </div>
              <button
                onClick={() => setSelectedSale(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Linhas de Itens da Venda */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-stone-300">Itens Consumidos:</span>
              <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 divide-y divide-stone-850 text-xs">
                {selectedSale.items?.map((it, idx) => (
                  <div key={idx} className="py-1.5 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-white mr-1.5">{it.quantity}x</span>
                      <span>{it.productName}</span>
                      <span className="text-[10px] text-stone-500 ml-1.5">
                        (IVA {(it.vatRate * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <span className="font-mono font-bold text-stone-200">
                      {formatCurrency(it.totalItemPrice)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Histórico de Pagamentos */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-stone-300">Pagamentos Registados:</span>
              <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 text-xs space-y-2">
                {!selectedSale.payments || selectedSale.payments.length === 0 ? (
                  <div className="text-stone-500 italic">Nenhum pagamento registado nesta venda.</div>
                ) : (
                  selectedSale.payments.map((p) => (
                    <div key={p.id} className="flex justify-between items-center">
                      <div>
                        <span className="font-bold uppercase text-white">{p.method}</span>
                        <span className="text-[10px] text-stone-400 ml-2">
                          por {p.registeredByName} às {formatTime(p.timestamp)}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-emerald-400">
                        {formatCurrency(p.amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Totais */}
            <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 space-y-1 text-xs">
              <div className="flex justify-between text-stone-400">
                <span>Subtotal (sem IVA):</span>
                <span>{formatCurrency(selectedSale.subtotal)}</span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>Total IVA:</span>
                <span>{formatCurrency(selectedSale.taxTotal)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-base text-white pt-1 border-t border-stone-800">
                <span>Total da Venda:</span>
                <span className="font-mono text-amber-400">{formatCurrency(selectedSale.total)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
              <button
                onClick={() => setSelectedSale(null)}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold rounded-lg"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

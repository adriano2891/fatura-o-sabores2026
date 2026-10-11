import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Calendar,
  User,
  CreditCard,
  Building2,
  RefreshCw,
  Eye,
  Share2,
} from 'lucide-react';
import { FiscalDocument, RestaurantSettings } from '../types';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { store } from '../services/storage';
import {
  createInvoicePdf,
  downloadOfficialInvoicePdf,
  getInvoicePdfBlob,
} from '../services/pdfGenerator';
import { OFFICIAL_LOGO_BASE64 } from '../services/logoAsset';

interface PublicInvoiceViewProps {
  tokenFromUrl?: string;
}

export const PublicInvoiceView: React.FC<PublicInvoiceViewProps> = ({ tokenFromUrl }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [document, setDocument] = useState<FiscalDocument | null>(null);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [viewMode, setViewMode] = useState<'interactive' | 'pdf_embed'>('interactive');
  const [copiedLink, setCopiedLink] = useState(false);

  // Extrai o token da URL atual de forma resiliente
  const extractToken = (): string => {
    if (tokenFromUrl) return tokenFromUrl;

    const path = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash.replace('#', '');

    if (searchParams.get('token')) return searchParams.get('token')!;
    if (searchParams.get('fatura')) return searchParams.get('fatura')!;
    if (searchParams.get('t')) return searchParams.get('t')!;

    if (path.startsWith('/fatura/')) {
      const segs = path.split('/').filter(Boolean);
      // /fatura/:token ou /fatura/:token/pdf
      if (segs.length >= 2) {
        return segs[1];
      }
    }

    if (hash.startsWith('fatura/')) {
      const segs = hash.split('/').filter(Boolean);
      if (segs.length >= 2) return segs[1];
    }

    return '';
  };

  const activeToken = extractToken();

  useEffect(() => {
    let isMounted = true;

    async function loadDocument() {
      setLoading(true);
      setError(null);

      if (!activeToken) {
        setError('Nenhum identificador de fatura fornecido no endereço.');
        setLoading(false);
        return;
      }

      try {
        let loadedDoc: FiscalDocument | null = null;
        let loadedSettings: RestaurantSettings | null = null;

        // 1. Tenta carregar do backend (API persistente com Content-Type: application/pdf)
        try {
          const apiRes = await fetch(`/api/fatura/${encodeURIComponent(activeToken)}`);
          if (apiRes.ok) {
            const data = await apiRes.json();
            if (data.ok && data.document) {
              loadedDoc = data.document;
              loadedSettings = data.settings || null;
            }
          }
        } catch (apiErr) {
          console.warn('Backend API fetch error, checking local store:', apiErr);
        }

        // 2. Fallback resiliente: Procura no estado local da aplicação
        if (!loadedDoc) {
          const state = store.getState();
          loadedSettings = state.settings;

          // Procura por secureToken, ID, série formatada ou ATCUD
          const cleanToken = decodeURIComponent(activeToken).toLowerCase();
          const found = state.fiscalDocuments.find((d) => {
            const dToken = (d.secureToken || '').toLowerCase();
            const dId = d.id.toLowerCase();
            const dSeries = d.series.replace(/[\s/]/g, '_').toLowerCase();
            const dAtcud = (d.atcud || '').toLowerCase();
            const dHashToken = `${d.atcud || 'AT'}_${(d.hashSignature || '').slice(0, 10)}`.toLowerCase();

            return (
              dToken === cleanToken ||
              cleanToken.includes(dId) ||
              dId.includes(cleanToken) ||
              dSeries === cleanToken ||
              cleanToken.includes(dSeries) ||
              dAtcud === cleanToken ||
              dHashToken === cleanToken
            );
          });

          if (found) {
            loadedDoc = found;
            // Regista no backend para que chamadas subsequentes e downloads diretos fiquem persistidos
            try {
              fetch('/api/invoices/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  document: found,
                  settings: loadedSettings,
                  secureToken: activeToken,
                }),
              }).catch(() => {});
            } catch {
              // ignora
            }
          }
        }

        if (!loadedDoc) {
          throw new Error('Não foi possível localizar uma fatura associada a este código ou o link de acesso expirou. Por favor, verifique o QR Code lido ou contacte o restaurante.');
        }

        if (!loadedSettings) {
          loadedSettings = store.getState().settings;
        }

        if (isMounted) {
          setDocument(loadedDoc);
          setSettings(loadedSettings);

          // Gera o Blob do PDF real oficial no cliente para pré-visualização instantânea
          try {
            const blob = await getInvoicePdfBlob(loadedDoc, loadedSettings);
            const url = URL.createObjectURL(blob);
            setPdfBlobUrl(url);
          } catch (pdfErr) {
            console.error('Erro ao gerar blob PDF:', pdfErr);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Erro ao carregar o documento fiscal.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDocument();

    return () => {
      isMounted = false;
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [activeToken]);

  // Handler para "Ver PDF"
  const handleViewPdf = () => {
    if (!document || !settings) return;

    // Se tivermos a rota direta do servidor, abre diretamente em nova janela com Content-Type: application/pdf
    const serverPdfUrl = `/fatura/${encodeURIComponent(activeToken)}/pdf`;
    
    // Tenta abrir no browser; se bloqueado ou mobile, usa blobUrl ou modo embed
    if (pdfBlobUrl) {
      window.open(pdfBlobUrl, '_blank');
    } else {
      window.open(serverPdfUrl, '_blank');
    }
    setViewMode('pdf_embed');
  };

  // Handler para "Descarregar PDF"
  const handleDownloadPdf = async () => {
    if (!document || !settings) return;

    setIsDownloading(true);
    try {
      // 1. Tenta descarregar via endpoint com Content-Disposition: attachment
      const serverDownloadUrl = `/fatura/${encodeURIComponent(activeToken)}/download`;
      
      const link = window.document.createElement('a');
      link.href = serverDownloadUrl;
      const parts = document.series.trim().split(/\s+/);
      const docSerie = (parts[0] || document.type).replace(/[^a-zA-Z0-9]/g, '');
      const docNum = (parts[1] || String(document.sequentialNumber)).replace(/[\/\\ ]/g, '_');
      link.download = `Fatura_Sabores_e_Nacoes_${docSerie}_${docNum}.pdf`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);

      // 2. Garantia client-side usando jsPDF oficial se o browser não disparar o download
      setTimeout(async () => {
        try {
          await downloadOfficialInvoicePdf(document, settings);
        } catch {
          // fallback
        }
      }, 300);
    } catch (err) {
      console.error('Erro ao descarregar PDF:', err);
      // Fallback direto via jsPDF
      await downloadOfficialInvoicePdf(document, settings);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShareLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Fatura ${document?.series} - Sabores & Nações`,
          text: `Fatura da sua compra na Sabores & Nações: ${document?.series}`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 3000);
      }
    } catch {
      // ignora cancelamento
    }
  };

  // Estado de Carregamento
  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col items-center justify-center p-4">
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-500">
            <RefreshCw className="w-8 h-8 animate-spin" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">A Carregar Documento Fiscal</h1>
            <p className="text-xs text-stone-400 mt-2 leading-relaxed">
              A validar o token seguro e a preparar o PDF oficial da fatura emitida pela Sabores & Nações...
            </p>
          </div>
          <div className="w-full bg-stone-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full w-2/3 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // Estado de Erro
  if (error || !document || !settings) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col items-center justify-center p-4">
        <div className="bg-stone-900 border border-rose-900/40 rounded-3xl p-8 max-w-md w-full text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-500">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Documento Indisponível ou Link Expirado</h1>
            <p className="text-xs text-rose-300/80 mt-2 leading-relaxed">
              {error || 'Não foi possível localizar uma fatura associada a este código ou o link de acesso expirou. Por favor, confirme o QR Code lido ou contacte o restaurante Sabores & Nações.'}
            </p>
          </div>
          <div className="bg-stone-950/80 border border-stone-800/80 rounded-2xl p-4 text-left text-xs text-stone-400 space-y-1.5">
            <div className="font-semibold text-stone-200">Precisa de ajuda com a sua fatura?</div>
            <div>Restaurante: <strong>Sabores & Nações</strong></div>
            <div>Telefone: <strong>+351 213 456 789</strong></div>
            <div>Email: <strong>faturacao@saboresenacoes.pt</strong></div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-stone-800 hover:bg-stone-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  const hash4 = (document.hashSignature || 'ABCD').slice(0, 4);
  const docTitle =
    document.type === 'FR'
      ? 'Fatura-Recibo'
      : document.type === 'FT'
      ? 'Fatura'
      : document.type === 'NC'
      ? 'Nota de Crédito'
      : 'Fatura Simplificada';

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500 selection:text-white">
      {/* Top Header Público */}
      <header className="border-b border-stone-800 bg-stone-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={OFFICIAL_LOGO_BASE64}
              alt="Sabores & Nações"
              className="w-10 h-10 object-contain rounded-full bg-white p-0.5 shadow-md"
            />
            <div>
              <div className="font-black text-sm text-white tracking-tight flex items-center gap-1.5">
                SABORES & NAÇÕES
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  AT Oficial
                </span>
              </div>
              <div className="text-[10px] text-stone-400">
                Mercado de São Carlos • Sintra • NIF {settings.nif}
              </div>
            </div>
          </div>

          <button
            onClick={handleShareLink}
            className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
            title="Partilhar link"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{copiedLink ? 'Copiado!' : 'Partilhar'}</span>
          </button>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 space-y-6">
        {/* Banner de Verificação Fiscal */}
        <div className="bg-gradient-to-r from-emerald-950/40 via-stone-900 to-stone-900 border border-emerald-800/40 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Documento Fiscal Certificado
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                {docTitle} {document.series}
              </h1>
              <p className="text-xs text-stone-400 mt-1">
                Processado por programa certificado n.º 712226142/AT • ATCUD: <strong className="text-stone-200">{document.atcud}</strong>
              </p>
            </div>
          </div>

          {/* Valor Total em Destaque */}
          <div className="sm:text-right bg-stone-950/60 sm:bg-transparent p-3 sm:p-0 rounded-2xl w-full sm:w-auto border sm:border-0 border-stone-800">
            <div className="text-[10px] uppercase font-bold text-stone-400">Total Pago</div>
            <div className="text-2xl sm:text-3xl font-black text-amber-400">
              {formatCurrency(document.grossTotal)}
            </div>
            <div className="text-[10px] text-emerald-400 font-semibold flex items-center sm:justify-end gap-1 mt-0.5">
              <CheckCircle2 className="w-3 h-3" /> Liquidado ({document.paymentMethod.toUpperCase()})
            </div>
          </div>
        </div>

        {/* Botões de Ação Principais (Responsivos e Destacados) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Botão 1: "Ver PDF" */}
          <button
            onClick={handleViewPdf}
            className="py-4 px-6 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white font-extrabold text-sm sm:text-base rounded-2xl shadow-lg shadow-sky-950/40 transition-all flex items-center justify-center gap-3 active:scale-[0.98] border border-sky-400/30 group"
          >
            <Eye className="w-5 h-5 text-sky-200 group-hover:scale-110 transition-transform" />
            <span>Ver PDF</span>
            <ExternalLink className="w-4 h-4 text-sky-300/80 ml-auto" />
          </button>

          {/* Botão 2: "Descarregar PDF" */}
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className="py-4 px-6 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-extrabold text-sm sm:text-base rounded-2xl shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-3 active:scale-[0.98] border border-emerald-400/30 group disabled:opacity-50"
          >
            {isDownloading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5 text-emerald-200 group-hover:translate-y-0.5 transition-transform" />
            )}
            <span>{isDownloading ? 'A Descarregar...' : 'Descarregar PDF'}</span>
            <span className="text-xs font-bold text-emerald-200/80 bg-emerald-900/60 px-2 py-0.5 rounded-lg ml-auto">
              A4 Oficial
            </span>
          </button>
        </div>

        {/* Separador de Modo de Visualização */}
        <div className="flex items-center justify-between bg-stone-900 p-1.5 rounded-2xl border border-stone-800">
          <button
            onClick={() => setViewMode('interactive')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              viewMode === 'interactive'
                ? 'bg-amber-500 text-stone-950 shadow-md font-black'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Detalhes da Fatura
          </button>
          <button
            onClick={() => setViewMode('pdf_embed')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              viewMode === 'pdf_embed'
                ? 'bg-amber-500 text-stone-950 shadow-md font-black'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> Pré-Visualizar Folha A4
          </button>
        </div>

        {/* Modo 1: Detalhes Interativos da Fatura */}
        {viewMode === 'interactive' && (
          <div className="space-y-6">
            {/* Dados Fiscais e Entidades */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Emitente */}
              <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-4 sm:p-5 space-y-2">
                <div className="text-[11px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Emitente
                </div>
                <div className="text-sm font-bold text-white">Sabores & Nações</div>
                <div className="text-xs text-stone-400 space-y-0.5">
                  <div>Titular: <strong>{settings.name}</strong></div>
                  <div>NIF: <strong>{settings.nif}</strong></div>
                  <div>Morada: {settings.address}, {settings.postalCode} {settings.city}</div>
                  <div>Estabelecimento: Mercado de São Carlos, Mem Martins</div>
                </div>
              </div>

              {/* Cliente */}
              <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-4 sm:p-5 space-y-2">
                <div className="text-[11px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Adquirente
                </div>
                <div className="text-sm font-bold text-white">{document.customerName}</div>
                <div className="text-xs text-stone-400 space-y-0.5">
                  <div>NIF: <strong>{document.customerNif || 'Consumidor Final'}</strong></div>
                  <div>Morada: {document.customerAddress || 'Não indicada'}</div>
                  <div className="pt-1 text-[11px] text-stone-500">
                    Data de Emissão: {formatDateTime(document.issuedAt)}
                  </div>
                </div>
              </div>
            </div>

            {/* Tabela de Produtos */}
            <div className="bg-stone-900/90 border border-stone-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="p-4 border-b border-stone-800 bg-stone-900 flex items-center justify-between">
                <h3 className="text-xs font-bold text-stone-300 uppercase tracking-wider">
                  Artigos Faturados ({document.items.length})
                </h3>
                <span className="text-[11px] text-stone-400">Moeda: EUR (€)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-950/80 text-stone-400 border-b border-stone-800">
                    <tr>
                      <th className="py-2.5 px-4 font-bold">Produto</th>
                      <th className="py-2.5 px-3 font-bold text-center">Qtd.</th>
                      <th className="py-2.5 px-3 font-bold text-right">Unit. s/IVA</th>
                      <th className="py-2.5 px-3 font-bold text-center">IVA</th>
                      <th className="py-2.5 px-4 font-bold text-right">Total c/IVA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/60">
                    {document.items.map((it, idx) => {
                      const unitExVat = it.total / (1 + it.vatRate) / (it.quantity || 1);
                      return (
                        <tr key={idx} className="hover:bg-stone-800/30 transition-colors">
                          <td className="py-3 px-4 font-medium text-stone-200">{it.productName}</td>
                          <td className="py-3 px-3 text-center text-stone-300">{it.quantity}</td>
                          <td className="py-3 px-3 text-right text-stone-300">{formatCurrency(unitExVat)}</td>
                          <td className="py-3 px-3 text-center text-stone-400">{(it.vatRate * 100).toFixed(0)}%</td>
                          <td className="py-3 px-4 text-right font-bold text-white">{formatCurrency(it.total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Resumo de IVA e Totais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Discriminação de IVA */}
              <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-4 space-y-2">
                <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                  Discriminação de IVA
                </div>
                <div className="divide-y divide-stone-800 text-xs">
                  {document.vatBreakdown.map((b, idx) => (
                    <div key={idx} className="py-2 flex items-center justify-between text-stone-300">
                      <span>Taxa {(b.rate * 100).toFixed(0)}% (Incidência {formatCurrency(b.baseAmount)})</span>
                      <span className="font-semibold text-white">{formatCurrency(b.vatAmount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bloco de Totais Finais */}
              <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-4 space-y-2.5">
                <div className="flex justify-between text-xs text-stone-400">
                  <span>Subtotal sem IVA</span>
                  <span className="font-semibold text-stone-200">{formatCurrency(document.subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-stone-400">
                  <span>Total de IVA</span>
                  <span className="font-semibold text-stone-200">{formatCurrency(document.taxTotal)}</span>
                </div>
                <div className="pt-2 border-t border-stone-800 flex justify-between items-center text-base font-black text-white">
                  <span>TOTAL LIQUIDADO</span>
                  <span className="text-xl text-amber-400">{formatCurrency(document.grossTotal)}</span>
                </div>
              </div>
            </div>

            {/* Dados de Validação e Assinatura AT */}
            <div className="bg-stone-900/70 border border-stone-800/80 rounded-2xl p-4 text-xs text-stone-400 space-y-2">
              <div className="font-bold text-stone-300 flex items-center gap-2">
                <QrCode className="w-4 h-4 text-amber-500" />
                Dados de Certificação e Auditoria AT
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div>ATCUD: <strong className="text-white">{document.atcud}</strong></div>
                <div>Hash de Controlo: <strong className="text-white">{hash4}</strong>-Processado por programa n.º 712226142</div>
                <div>Data/Hora: {formatDateTime(document.issuedAt)}</div>
                <div>Disponibilização: Bens/serviços colocados à disposição na data do documento.</div>
              </div>
            </div>
          </div>
        )}

        {/* Modo 2: Visualizador da Folha A4 Real do PDF */}
        {viewMode === 'pdf_embed' && (
          <div className="space-y-4">
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-3 flex items-center justify-between text-xs">
              <div className="text-stone-300 font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                Documento A4 Oficial de Faturação
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleViewPdf}
                  className="px-3 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-bold flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Ecrã Inteiro
                </button>
                <button
                  onClick={handleDownloadPdf}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Descarregar
                </button>
              </div>
            </div>

            {/* Embed do PDF */}
            <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-2xl p-2 sm:p-4">
              {pdfBlobUrl ? (
                <iframe
                  src={`${pdfBlobUrl}#view=FitH`}
                  title={`Fatura ${document.series}`}
                  className="w-full h-[700px] sm:h-[850px] rounded-2xl border border-stone-800 bg-white"
                />
              ) : (
                <div className="h-96 flex flex-col items-center justify-center text-center p-6 space-y-4">
                  <FileText className="w-12 h-12 text-stone-600" />
                  <p className="text-xs text-stone-400">
                    O seu dispositivo pode não suportar visualização direta embutida de PDF.
                  </p>
                  <button
                    onClick={handleViewPdf}
                    className="px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold"
                  >
                    Abrir PDF em Nova Janela
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rodapé e Declaração Legal */}
        <footer className="pt-6 border-t border-stone-800/80 text-center text-xs text-stone-500 space-y-1.5">
          <div>Obrigado pela sua preferência! Sabores & Nações • Sintra, Portugal</div>
          <div className="text-[11px] text-stone-600">
            Documento emitido em conformidade com o Decreto-Lei n.º 28/2019 e Portaria n.º 363/2010.
          </div>
        </footer>
      </main>
    </div>
  );
};

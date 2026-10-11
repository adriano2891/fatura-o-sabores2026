/**
 * Sabores & Nações - Gerador de Fatura e Documento Fiscal Certificado em PDF
 * Reprodução 100% fiel ao layout oficial de referência: https://i.ibb.co/SX8tymV7/chatgpt-39.png
 *
 * Características:
 * - Formato A4 vertical regulamentar (210 x 297 mm) com margens precisas de 15 mm
 * - Logótipo oficial Sabores & Nações nítido no topo esquerdo
 * - Paleta de cores oficial: Azul Navy (#002D5B), Dourado/Mostarda (#CA8A04 / #EAB308), Cinzento Neutro
 * - Conteúdo 100% como texto selecionável e elementos vetoriais nítidos (sem capturas de ecrã)
 * - Tabela de produtos com continuação automática em múltiplas páginas para listas longas
 * - Quadro de Totais com bloco em destaque "TOTAL PAGO", discriminação de IVA e dados de pagamento
 * - Bloco de Autenticação Fiscal com ATCUD, 4 caracteres de controlo (Hash), Certificação AT n.º 712226142
 * - QR Code Fiscal oficial da AT (Portaria n.º 195/2020) gerado dinamicamente
 * - Nomenclatura oficial: Fatura_Sabores_e_Nacoes_[serie]_[numero].pdf
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { FiscalDocument, RestaurantSettings } from '../types';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { OFFICIAL_LOGO_BASE64 } from './logoAsset';

// Cores Oficiais da Marca e Referência Visual
const NAVY_COLOR: [number, number, number] = [0, 45, 91];       // #002D5B (Azul Marinho Principal)
const GOLD_COLOR: [number, number, number] = [202, 138, 4];     // #CA8A04 (Dourado / Mostarda Rótulos)
const GOLD_BG: [number, number, number] = [254, 243, 199];      // #FEF3C7 (Fundo Faixa Modelo)
const GOLD_BORDER: [number, number, number] = [252, 211, 77];   // #FCD34D (Borda Faixa Modelo)
const GOLD_TEXT: [number, number, number] = [146, 64, 14];      // #92400E (Texto Faixa Modelo)
const DARK_TEXT: [number, number, number] = [17, 24, 39];       // #111827 (Texto Principal)
const MUTED_TEXT: [number, number, number] = [107, 114, 128];   // #6B7280 (Texto Secundário)
const LIGHT_BG: [number, number, number] = [243, 244, 246];     // #F3F4F6 (Fundo de Cabeçalhos)
const BORDER_COLOR: [number, number, number] = [229, 231, 235]; // #E5E7EB (Divisórias)

/**
 * Monta a string oficial do QR Code AT (Portaria n.º 195/2020) caso não venha preenchida
 */
export function buildAtQrCodeString(document: FiscalDocument, settings: RestaurantSettings): string {
  if (document.qrCodeData && document.qrCodeData.startsWith('A:')) {
    return document.qrCodeData;
  }

  const emitterNif = (settings.nif || '517992458').replace(/\D/g, '');
  const customerNif = (document.customerNif || '999999990').replace(/\D/g, '') || '999999990';
  const docDate = document.issuedAt.slice(0, 10);
  const hash4 = (document.hashSignature || 'ABCD').slice(0, 4);
  const atcud = document.atcud || 'CS5DF88G-1';
  const taxBase = document.subtotal.toFixed(2);
  const vatTotal = document.taxTotal.toFixed(2);
  const grossTotal = document.grossTotal.toFixed(2);

  return `A:${emitterNif}*B:${customerNif}*C:PT*D:${document.type}*E:N*F:${docDate}*G:${document.series}*H:${atcud}*I1:PT*I7:${taxBase}*I8:${vatTotal}*N:${vatTotal}*O:${grossTotal}*Q:${hash4}*R:712226142`;
}

/**
 * Verifica se um endereço corresponde a ambiente de desenvolvimento interno ou Google Cloud IAP/preview.
 * NUNCA enviar endereços deste tipo aos clientes (evita o erro "403 — Você não tem acesso a esta página").
 */
export function isInternalDevOrGoogleDomain(urlOrOrigin: string): boolean {
  if (!urlOrOrigin) return true;
  const lower = urlOrOrigin.toLowerCase();
  return (
    lower.includes('run.app') ||
    lower.includes('google.com') ||
    lower.includes('googleusercontent.com') ||
    lower.includes('aistudio') ||
    lower.includes('cloudworkstations.dev') ||
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    lower.includes('0.0.0.0') ||
    lower.includes('webcontainer')
  );
}

/** Domínio público oficial e certificado da Sabores & Nações */
export const OFFICIAL_PUBLISHED_INVOICE_DOMAIN = 'https://faturas.saboresenacoes.pt';

/**
 * Obtém o domínio oficial publicado para acesso público de clientes (sem necessidade de conta Google ou login)
 */
export function getPublishedInvoiceBaseUrl(settings?: Partial<RestaurantSettings>): string {
  if (settings?.publishedInvoiceDomain && settings.publishedInvoiceDomain.trim()) {
    const trimmed = settings.publishedInvoiceDomain.trim().replace(/\/+$/, '');
    if (!isInternalDevOrGoogleDomain(trimmed)) {
      return trimmed;
    }
  }
  return OFFICIAL_PUBLISHED_INVOICE_DOMAIN;
}

/**
 * Gera um token seguro, aleatório, de alta entropia e exclusivo para a fatura (requisito de não-previsibilidade)
 */
export function generateRandomSecureInvoiceToken(document?: Partial<FiscalDocument>): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let rand = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < bytes.length; i++) {
      rand += chars[bytes[i] % chars.length];
    }
  } else {
    for (let i = 0; i < 12; i++) {
      rand += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  const seriesTag = document?.series
    ? document.series.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    : 'fat';
  return `sn-${seriesTag}-${rand}`;
}

/**
 * Retorna o token exclusivo seguro da fatura
 */
export function getInvoiceSecureToken(document: FiscalDocument): string {
  if (document.secureToken && document.secureToken.trim()) {
    return document.secureToken.trim();
  }
  // Se ainda não existir token aleatório, gera um novo exclusivo e guarda no documento
  const newToken = generateRandomSecureInvoiceToken(document);
  document.secureToken = newToken;
  return newToken;
}

export interface GetInvoiceUrlOptions {
  settings?: Partial<RestaurantSettings>;
  customOrigin?: string;
  allowLocalPreview?: boolean;
}

/**
 * Retorna o endereço HTTPS canónico da página de consulta da fatura.
 * Garante que clientes externos (WhatsApp, E-mail e QR Code) recebem o domínio publicado da Sabores & Nações,
 * sem nunca redirecionar para ambientes internos ou páginas com erro Google 403.
 */
export function getInvoiceSecureUrl(
  document: FiscalDocument,
  options?: GetInvoiceUrlOptions | string
): string {
  const token = getInvoiceSecureToken(document);
  let targetOrigin = '';
  let allowLocal = false;
  let settings: Partial<RestaurantSettings> | undefined = undefined;

  if (typeof options === 'string') {
    targetOrigin = options;
  } else if (options) {
    targetOrigin = options.customOrigin || '';
    allowLocal = !!options.allowLocalPreview;
    settings = options.settings;
  }

  // Se allowLocal for explicitamente solicitado (ex: teste dentro do próprio POS na máquina do operador)
  if (allowLocal && typeof window !== 'undefined' && window.location && window.location.origin) {
    return `${window.location.origin}/fatura/${encodeURIComponent(token)}`;
  }

  // Para envio oficial por WhatsApp, E-mail ou QR Code impresso no papel:
  // Se for endereço interno/Google dev ou vazio, utiliza SEMPRE o domínio publicado oficial
  if (!targetOrigin || isInternalDevOrGoogleDomain(targetOrigin)) {
    targetOrigin = getPublishedInvoiceBaseUrl(settings);
  }

  return `${targetOrigin.replace(/\/+$/, '')}/fatura/${encodeURIComponent(token)}`;
}

/**
 * Cria o objeto jsPDF oficial reproduzindo fielmente o layout de referência
 */
export async function createInvoicePdf(
  document: FiscalDocument,
  settings: RestaurantSettings
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 15;
  const contentWidth = pageWidth - marginX * 2; // 180 mm

  // 1. Gera o QR Code FISCAL obrigatório (Portaria n.º 195/2020)
  const qrFiscalString = buildAtQrCodeString(document, settings);
  let qrFiscalDataUrl = '';
  try {
    qrFiscalDataUrl = await QRCode.toDataURL(qrFiscalString, {
      margin: 1,
      width: 260,
      color: { dark: '#002D5B', light: '#FFFFFF' },
    });
  } catch (err) {
    console.error('Erro ao gerar QRCode Fiscal:', err);
  }

  // 2. Gera o QR Code de CONSULTA exclusivo (com HTTPS e token seguro de alta legibilidade)
  const consultUrl = getInvoiceSecureUrl(document, { settings });
  let qrConsultDataUrl = '';
  try {
    qrConsultDataUrl = await QRCode.toDataURL(consultUrl, {
      margin: 2,
      width: 300,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#FFFFFF' },
    });
  } catch (err) {
    console.error('Erro ao gerar QRCode de Consulta:', err);
  }

  const docTitle =
    document.type === 'FR'
      ? 'FATURA-RECIBO'
      : document.type === 'FT'
      ? 'FATURA'
      : document.type === 'NC'
      ? 'NOTA DE CRÉDITO'
      : 'FATURA SIMPLIFICADA';

  // Identifica se é modelo/rascunho ou se já tem emissão fiscal definitiva
  const isSimulation =
    !document.atcud ||
    document.atcud.includes('0000') ||
    settings.vendusTestMode ||
    (document as any).isSimulation === true;

  // Função auxiliar para desenhar o cabeçalho idêntico à referência visual
  const drawPageHeader = (pageNumber: number) => {
    // 1. Logótipo Oficial
    try {
      doc.addImage(OFFICIAL_LOGO_BASE64, 'PNG', marginX, 12, 23, 23);
    } catch {
      // Fallback estético caso a imagem base64 falhe
      doc.setFillColor(NAVY_COLOR[0], NAVY_COLOR[1], NAVY_COLOR[2]);
      doc.circle(marginX + 11.5, 23.5, 11.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text('S&N', marginX + 11.5, 25, { align: 'center' });
    }

    // 2. Título da Empresa e Localização
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(NAVY_COLOR[0], NAVY_COLOR[1], NAVY_COLOR[2]);
    doc.text('SABORES & NAÇÕES', marginX + 27, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(75, 85, 99);
    doc.text('Sabores do mundo com toque brasileiro', marginX + 27, 23.5);

    doc.setFontSize(8.5);
    doc.setTextColor(107, 114, 128);
    doc.text('| Mercado de São Carlos | Mem Martins, Sintra', marginX + 27, 28.5);

    // 3. Faixa de Modelo ou de Validade Fiscal
    const bannerY = 36;
    if (isSimulation) {
      doc.setFillColor(GOLD_BG[0], GOLD_BG[1], GOLD_BG[2]);
      doc.setDrawColor(GOLD_BORDER[0], GOLD_BORDER[1], GOLD_BORDER[2]);
      doc.setLineWidth(0.3);
      doc.roundedRect(marginX, bannerY, contentWidth, 6.5, 1.2, 1.2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(GOLD_TEXT[0], GOLD_TEXT[1], GOLD_TEXT[2]);
      doc.text(
        'MODELO PARA EMISSÃO • SEM VALIDADE FISCAL',
        pageWidth / 2,
        bannerY + 4.3,
        { align: 'center' }
      );
    } else {
      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(187, 247, 208);
      doc.setLineWidth(0.3);
      doc.roundedRect(marginX, bannerY, contentWidth, 6.5, 1.2, 1.2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(22, 101, 52);
      doc.text(
        'DOCUMENTO FISCAL ORIGINAL • COMUNICAÇÃO OFICIAL AT',
        pageWidth / 2,
        bannerY + 4.3,
        { align: 'center' }
      );
    }

    // 4. Identificação do Documento
    const idY = 49;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(NAVY_COLOR[0], NAVY_COLOR[1], NAVY_COLOR[2]);
    doc.text(docTitle, marginX, idY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
    doc.text(`N.º ${document.series}  |  Moeda: EUR`, marginX, idY + 5.5);

    doc.setFontSize(8.5);
    doc.setTextColor(MUTED_TEXT[0], MUTED_TEXT[1], MUTED_TEXT[2]);
    doc.text(`Emissão: ${formatDateTime(document.issuedAt)}`, marginX + contentWidth, idY, {
      align: 'right',
    });
    doc.text(`Operação: ${formatDateTime(document.issuedAt)}`, marginX + contentWidth, idY + 5, {
      align: 'right',
    });

    // 5. Bloco de Entidades em Duas Colunas (EMITENTE e CLIENTE)
    const entityY = 62;

    // Coluna Esquerda: EMITENTE
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(GOLD_COLOR[0], GOLD_COLOR[1], GOLD_COLOR[2]);
    doc.text('EMITENTE', marginX, entityY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
    doc.text('Sabores & Nações (marca comercial)', marginX, entityY + 4.5);
    doc.text(`Titular: ${settings.name}`, marginX, entityY + 8.5);
    doc.text(`NIF: ${settings.nif}`, marginX, entityY + 12.5);
    doc.text(`Morada fiscal: ${settings.address}, ${settings.postalCode} ${settings.city}`, marginX, entityY + 16.5);
    doc.text('Estabelecimento: Mercado de São Carlos, Mem Martins', marginX, entityY + 20.5);

    // Coluna Direita: CLIENTE
    const colRightX = marginX + 96;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(GOLD_COLOR[0], GOLD_COLOR[1], GOLD_COLOR[2]);
    doc.text('CLIENTE', colRightX, entityY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
    doc.text(`Nome: ${document.customerName}`, colRightX, entityY + 4.5);
    doc.text(`NIF: ${document.customerNif || 'Consumidor Final'}`, colRightX, entityY + 8.5);
    doc.text(`Morada: ${document.customerAddress || 'Não indicada'}`, colRightX, entityY + 12.5);
    const orderRef = document.orderNumber || `#PED-${document.sequentialNumber} • ${document.series}`;
    doc.text(`Pedido: ${orderRef}`, colRightX, entityY + 16.5);
  };

  // Função auxiliar para desenhar a barra de cabeçalho da tabela de artigos
  const drawTableHeaderBar = (y: number) => {
    doc.setFillColor(NAVY_COLOR[0], NAVY_COLOR[1], NAVY_COLOR[2]);
    doc.rect(marginX, y, contentWidth, 7.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);

    doc.text('Produto', marginX + 3, y + 5);
    doc.text('Qtd.', marginX + 98, y + 5, { align: 'center' });
    doc.text('Unit. s/IVA', marginX + 128, y + 5, { align: 'right' });
    doc.text('IVA', marginX + 148, y + 5, { align: 'center' });
    doc.text('Total c/IVA', marginX + contentWidth - 3, y + 5, { align: 'right' });
  };

  // 1ª Página: Desenha cabeçalho inicial
  drawPageHeader(1);

  // Início da Tabela de Produtos na 1ª Página
  let currentY = 91;
  drawTableHeaderBar(currentY);
  currentY += 7.5;

  let pageIndex = 1;

  // Itera sobre todos os itens com suporte a quebra de página automática
  for (let i = 0; i < document.items.length; i++) {
    const item = document.items[i];
    const unitPriceExVat = item.total / (1 + item.vatRate) / (item.quantity || 1);

    // Se estiver perto do fim da página, cria nova página
    // 205 mm é o limite seguro na página final antes dos blocos de totais e fiscal
    if (currentY > 200) {
      doc.addPage();
      pageIndex++;
      drawPageHeader(pageIndex);
      currentY = 91;
      drawTableHeaderBar(currentY);
      currentY += 7.5;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);

    const pName =
      item.productName.length > 44
        ? item.productName.substring(0, 41) + '...'
        : item.productName;

    doc.text(pName, marginX + 3, currentY + 4.8);
    doc.text(`${item.quantity}`, marginX + 98, currentY + 4.8, { align: 'center' });
    doc.text(formatCurrency(unitPriceExVat), marginX + 128, currentY + 4.8, { align: 'right' });
    doc.text(`${(item.vatRate * 100).toFixed(0)}%`, marginX + 148, currentY + 4.8, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(item.total), marginX + contentWidth - 3, currentY + 4.8, { align: 'right' });

    // Linha divisória sutil
    doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
    doc.setLineWidth(0.2);
    doc.line(marginX, currentY + 7, marginX + contentWidth, currentY + 7);

    currentY += 7.2;
  }

  // Nota de rodapé da tabela (conforme layout de referência)
  currentY += 2;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED_TEXT[0], MUTED_TEXT[1], MUTED_TEXT[2]);
  const sampleItem = document.items[0];
  const unitWithVat = sampleItem ? sampleItem.total / (sampleItem.quantity || 1) : 0;
  doc.text(`Preço unitário com IVA: ${formatCurrency(unitWithVat)}.`, marginX + 2, currentY + 3);

  currentY += 7;

  // Se o espaço restante for insuficiente para totais e rodapé (~65 mm), adiciona nova página
  if (currentY > 215) {
    doc.addPage();
    pageIndex++;
    drawPageHeader(pageIndex);
    currentY = 91;
  }

  // ==========================================
  // BLOCO DE RESUMO DE IVA E TOTAIS (Lado a Lado)
  // ==========================================
  const totalsY = Math.max(currentY, 140);

  // Coluna Esquerda: RESUMO DE IVA
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(GOLD_COLOR[0], GOLD_COLOR[1], GOLD_COLOR[2]);
  doc.text('RESUMO DE IVA', marginX, totalsY);

  // Cabeçalho da tabela de resumo de IVA
  const vatTableY = totalsY + 3;
  doc.setFillColor(LIGHT_BG[0], LIGHT_BG[1], LIGHT_BG[2]);
  doc.rect(marginX, vatTableY, 88, 5.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
  doc.text('Taxa', marginX + 3, vatTableY + 4);
  doc.text('Base tributável', marginX + 50, vatTableY + 4, { align: 'right' });
  doc.text('IVA', marginX + 85, vatTableY + 4, { align: 'right' });

  // Linhas de taxas de IVA
  let vatRowY = vatTableY + 5.5;
  doc.setFont('helvetica', 'normal');
  for (const b of document.vatBreakdown) {
    doc.text(`${(b.rate * 100).toFixed(0)}%`, marginX + 3, vatRowY + 4);
    doc.text(formatCurrency(b.baseAmount), marginX + 50, vatRowY + 4, { align: 'right' });
    doc.text(formatCurrency(b.vatAmount), marginX + 85, vatRowY + 4, { align: 'right' });

    doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
    doc.setLineWidth(0.15);
    doc.line(marginX, vatRowY + 5.5, marginX + 88, vatRowY + 5.5);
    vatRowY += 5.5;
  }

  // Coluna Direita: TOTAIS E BLOCO "TOTAL PAGO"
  const totalsColX = marginX + 96;
  const totalsColWidth = contentWidth - 96;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED_TEXT[0], MUTED_TEXT[1], MUTED_TEXT[2]);
  doc.text('Subtotal sem IVA', totalsColX, totalsY + 4);
  doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
  doc.text(formatCurrency(document.subtotal), marginX + contentWidth - 2, totalsY + 4, { align: 'right' });

  doc.setTextColor(MUTED_TEXT[0], MUTED_TEXT[1], MUTED_TEXT[2]);
  doc.text('IVA', totalsColX, totalsY + 9.5);
  doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
  doc.text(formatCurrency(document.taxTotal), marginX + contentWidth - 2, totalsY + 9.5, { align: 'right' });

  // Bloco Navy "TOTAL PAGO"
  const totalBoxY = totalsY + 14;
  doc.setFillColor(NAVY_COLOR[0], NAVY_COLOR[1], NAVY_COLOR[2]);
  doc.roundedRect(totalsColX, totalBoxY, totalsColWidth, 13, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  const totalLabel = document.type === 'NC' ? 'TOTAL A CRÉDITO' : document.type === 'FT' ? 'TOTAL A PAGAR' : 'TOTAL PAGO';
  doc.text(totalLabel, totalsColX + 5, totalBoxY + 8.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.text(formatCurrency(document.grossTotal), marginX + contentWidth - 5, totalBoxY + 8.5, { align: 'right' });

  // Informações de Pagamento (Abaixo dos Totais)
  const payInfoY = totalBoxY + 19;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
  doc.text(`Pagamento: ${document.paymentMethod.toUpperCase()}  |  Estado: Liquidado`, totalsColX, payInfoY);
  doc.text(`Data do pagamento: ${formatDateTime(document.issuedAt)}`, totalsColX, payInfoY + 4.5);

  // ==========================================
  // RODAPÉ FISCAL E QR CODE (Conforme Referência)
  // ==========================================
  const footerY = 246;

  // Linha divisória superior do rodapé
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
  doc.setLineWidth(0.3);
  doc.line(marginX, footerY, marginX + contentWidth, footerY);

  // Esquerda: DADOS GERADOS PELO SISTEMA DE FATURAÇÃO
  const footDataY = footerY + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
  doc.text('DADOS GERADOS PELO SISTEMA DE FATURAÇÃO', marginX, footDataY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(55, 65, 81);
  doc.text(`ATCUD: ${document.atcud}`, marginX, footDataY + 4.5);

  const hash4 = (document.hashSignature || 'ABCD').slice(0, 4);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(NAVY_COLOR[0], NAVY_COLOR[1], NAVY_COLOR[2]);
  doc.text(`${hash4}-Processado por programa certificado n.º 712226142/AT`, marginX, footDataY + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(MUTED_TEXT[0], MUTED_TEXT[1], MUTED_TEXT[2]);
  doc.text('Os bens/serviços foram colocados à disposição do adquirente na data e local do documento.', marginX, footDataY + 13.5);
  doc.text('Documento emitido ao abrigo do Decreto-Lei n.º 28/2019 e Portaria n.º 363/2010.', marginX, footDataY + 17.5);

  // Direita: DOIS QUADROS DE QR CODES (QR Fiscal Obrigatório + QR de Consulta Separado)
  const qrBoxSize = 25;
  const qrFiscalX = marginX + contentWidth - 55; // 140 mm
  const qrConsultX = marginX + contentWidth - 25; // 170 mm
  const qrBoxY = footerY + 2;

  // 1. Quadro do QR FISCAL (Portaria 195/2020)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(NAVY_COLOR[0], NAVY_COLOR[1], NAVY_COLOR[2]);
  doc.setLineWidth(0.35);
  doc.rect(qrFiscalX, qrBoxY, qrBoxSize, qrBoxSize, 'FD');

  if (qrFiscalDataUrl) {
    try {
      doc.addImage(qrFiscalDataUrl, 'PNG', qrFiscalX + 0.8, qrBoxY + 0.8, qrBoxSize - 1.6, qrBoxSize - 1.6);
    } catch {
      // Fallback
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(NAVY_COLOR[0], NAVY_COLOR[1], NAVY_COLOR[2]);
  doc.text('QR FISCAL', qrFiscalX + qrBoxSize / 2, qrBoxY + qrBoxSize + 3.2, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(MUTED_TEXT[0], MUTED_TEXT[1], MUTED_TEXT[2]);
  doc.text('AT Obrigatório', qrFiscalX + qrBoxSize / 2, qrBoxY + qrBoxSize + 5.8, { align: 'center' });

  // 2. Quadro do QR CODE DE CONSULTA (Acesso direto à fatura com HTTPS e token seguro)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]); // Alto contraste nítido
  doc.setLineWidth(0.4);
  doc.rect(qrConsultX, qrBoxY, qrBoxSize, qrBoxSize, 'FD');

  if (qrConsultDataUrl) {
    try {
      doc.addImage(qrConsultDataUrl, 'PNG', qrConsultX + 0.8, qrBoxY + 0.8, qrBoxSize - 1.6, qrBoxSize - 1.6);
    } catch {
      // Fallback
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(GOLD_COLOR[0], GOLD_COLOR[1], GOLD_COLOR[2]);
  doc.text('CONSULTAR FATURA', qrConsultX + qrBoxSize / 2, qrBoxY + qrBoxSize + 3.2, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(MUTED_TEXT[0], MUTED_TEXT[1], MUTED_TEXT[2]);
  doc.text('Aponte a câmara', qrConsultX + qrBoxSize / 2, qrBoxY + qrBoxSize + 5.8, { align: 'center' });

  // Mensagem Final e Isenção / Conformidade
  const closingY = footerY + 28;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(NAVY_COLOR[0], NAVY_COLOR[1], NAVY_COLOR[2]);
  doc.text('Obrigada pela sua compra!', marginX, closingY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(MUTED_TEXT[0], MUTED_TEXT[1], MUTED_TEXT[2]);
  if (isSimulation) {
    doc.text(
      'Valores e IVA ilustrativos. Confirmar o regime fiscal aplicável. Validade fiscal apenas após emissão pelo sistema autorizado com dados reais.',
      marginX,
      closingY + 4
    );
  } else {
    doc.text(
      'Documento original certificado. Consulte o documento no e-Fatura da Autoridade Tributária e Aduaneira.',
      marginX,
      closingY + 4
    );
  }

  // Número da Página
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED_TEXT[0], MUTED_TEXT[1], MUTED_TEXT[2]);
    doc.text(`Página ${p} de ${totalPages}`, marginX + contentWidth, pageHeight - 8, {
      align: 'right',
    });
  }

  return doc;
}

/**
 * Descarrega o PDF oficial do documento como ficheiro PDF binário real (%PDF)
 * Nomenclatura requerida: Fatura_Sabores_e_Nacoes_[serie]_[numero].pdf
 */
export async function downloadOfficialInvoicePdf(
  document: FiscalDocument,
  settings: RestaurantSettings
): Promise<void> {
  const doc = await createInvoicePdf(document, settings);

  // Nomenclatura requerida: Fatura_Sabores_e_Nacoes_[serie]_[numero].pdf
  const parts = document.series.trim().split(/\s+/);
  const docSerie = (parts[0] || document.type).replace(/[^a-zA-Z0-9]/g, '');
  const docNum = (parts[1] || String(document.sequentialNumber)).replace(/[\/\\ ]/g, '_');
  const cleanName = `Fatura_Sabores_e_Nacoes_${docSerie}_${docNum}.pdf`;

  doc.save(cleanName);
}

/**
 * Retorna o Blob do PDF binário para anexo e envio eletrónico
 */
export async function getInvoicePdfBlob(
  document: FiscalDocument,
  settings: RestaurantSettings
): Promise<Blob> {
  const doc = await createInvoicePdf(document, settings);
  return doc.output('blob');
}

/**
 * Gera a versão HTML da Fatura Oficial reproduzindo fielmente o layout para pré-visualização no ecrã
 */
export function generateOfficialInvoiceHtml(
  document: FiscalDocument,
  settings: RestaurantSettings
): string {
  const docTitle =
    document.type === 'FR'
      ? 'FATURA-RECIBO'
      : document.type === 'FT'
      ? 'FATURA'
      : document.type === 'NC'
      ? 'NOTA DE CRÉDITO'
      : 'FATURA SIMPLIFICADA';

  const isSimulation =
    !document.atcud ||
    document.atcud.includes('0000') ||
    settings.vendusTestMode ||
    (document as any).isSimulation === true;

  const sampleItem = document.items[0];
  const unitWithVat = sampleItem ? sampleItem.total / (sampleItem.quantity || 1) : 0;
  const hash4 = (document.hashSignature || 'ABCD').slice(0, 4);

  return `
<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8">
  <title>${docTitle} ${document.series}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #111827;
      margin: 0;
      padding: 15mm;
      font-size: 11px;
      line-height: 1.4;
      background: #ffffff;
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    .logo-img {
      width: 64px;
      height: 64px;
      object-fit: contain;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      color: #002D5B;
      margin: 0;
      letter-spacing: -0.2px;
    }
    .brand-sub {
      font-size: 11px;
      color: #4B5563;
      margin-top: 2px;
    }
    .brand-loc {
      font-size: 10px;
      color: #6B7280;
      margin-top: 2px;
    }
    .banner-modelo {
      background: #FEF3C7;
      border: 1px solid #FCD34D;
      color: #92400E;
      text-align: center;
      padding: 5px 10px;
      font-weight: 800;
      font-size: 10px;
      border-radius: 4px;
      margin: 12px 0 16px 0;
      letter-spacing: 0.5px;
    }
    .banner-oficial {
      background: #F0FDF4;
      border: 1px solid #BBF7D0;
      color: #166534;
      text-align: center;
      padding: 5px 10px;
      font-weight: 800;
      font-size: 10px;
      border-radius: 4px;
      margin: 12px 0 16px 0;
      letter-spacing: 0.5px;
    }
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }
    .doc-title {
      font-size: 22px;
      font-weight: 800;
      color: #002D5B;
      margin: 0;
      letter-spacing: -0.3px;
    }
    .doc-num {
      font-size: 11px;
      color: #111827;
      margin-top: 3px;
    }
    .doc-dates {
      text-align: right;
      font-size: 10px;
      color: #6B7280;
    }
    .entities-grid {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      margin-bottom: 20px;
    }
    .entity-col {
      flex: 1;
    }
    .entity-title {
      font-size: 11px;
      font-weight: 800;
      color: #CA8A04;
      margin-bottom: 4px;
      letter-spacing: 0.5px;
    }
    .entity-item {
      font-size: 10px;
      color: #111827;
      line-height: 1.5;
    }
    .products-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6px;
    }
    .products-table th {
      background: #002D5B;
      color: #ffffff;
      padding: 6px 8px;
      font-size: 10px;
      font-weight: 700;
      text-align: left;
    }
    .products-table th.center { text-align: center; }
    .products-table th.right { text-align: right; }
    .products-table td {
      padding: 7px 8px;
      border-bottom: 1px solid #E5E7EB;
      font-size: 10.5px;
    }
    .products-table td.center { text-align: center; }
    .products-table td.right { text-align: right; }
    .products-table td.bold { font-weight: 700; }
    .table-note {
      font-size: 9px;
      font-style: italic;
      color: #6B7280;
      margin-bottom: 24px;
    }
    .summary-grid {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      margin-bottom: 24px;
    }
    .vat-col {
      flex: 1;
    }
    .totals-col {
      width: 260px;
    }
    .vat-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
    }
    .vat-table th {
      background: #F3F4F6;
      color: #111827;
      padding: 5px 6px;
      font-size: 9.5px;
      font-weight: 700;
      text-align: left;
    }
    .vat-table th.right { text-align: right; }
    .vat-table td {
      padding: 5px 6px;
      border-bottom: 1px solid #E5E7EB;
      font-size: 9.5px;
    }
    .vat-table td.right { text-align: right; }
    .tot-row {
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      margin-bottom: 6px;
      color: #6B7280;
    }
    .tot-row .val {
      color: #111827;
      font-weight: 600;
    }
    .total-paid-box {
      background: #002D5B;
      color: #ffffff;
      padding: 10px 14px;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 10px 0 8px 0;
    }
    .total-paid-label {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .total-paid-val {
      font-size: 18px;
      font-weight: 800;
    }
    .pay-details {
      font-size: 9.5px;
      color: #111827;
      line-height: 1.5;
    }
    .footer-divider {
      border-top: 1px solid #E5E7EB;
      margin: 20px 0 12px 0;
    }
    .footer-grid {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }
    .fiscal-data-col {
      flex: 1;
    }
    .fiscal-head {
      font-size: 9.5px;
      font-weight: 800;
      color: #111827;
      margin-bottom: 3px;
    }
    .fiscal-line {
      font-size: 9px;
      color: #374151;
      line-height: 1.4;
    }
    .fiscal-cert {
      font-weight: 700;
      color: #002D5B;
    }
    .qr-box-wrap {
      width: 90px;
      text-align: center;
    }
    .qr-frame {
      width: 80px;
      height: 80px;
      border: 1px solid #002D5B;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: 8px;
      background: #FAFAFA;
    }
    .qr-label {
      font-size: 7.5px;
      font-weight: 800;
      color: #002D5B;
      margin-top: 3px;
    }
    .qr-sub {
      font-size: 7px;
      color: #6B7280;
    }
    .final-closing {
      margin-top: 16px;
    }
    .closing-thank {
      font-size: 11px;
      font-weight: 800;
      color: #002D5B;
    }
    .closing-disclaimer {
      font-size: 8.5px;
      color: #6B7280;
      margin-top: 2px;
    }
  </style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td style="width: 72px; vertical-align: top;">
        <img class="logo-img" src="${OFFICIAL_LOGO_BASE64}" alt="Sabores & Nações" />
      </td>
      <td style="vertical-align: middle; padding-left: 8px;">
        <h1 class="brand-title">SABORES & NAÇÕES</h1>
        <div class="brand-sub">Sabores do mundo com toque brasileiro</div>
        <div class="brand-loc">| Mercado de São Carlos | Mem Martins, Sintra</div>
      </td>
    </tr>
  </table>

  ${
    isSimulation
      ? '<div class="banner-modelo">MODELO PARA EMISSÃO • SEM VALIDADE FISCAL</div>'
      : '<div class="banner-oficial">DOCUMENTO FISCAL ORIGINAL • COMUNICAÇÃO OFICIAL AT</div>'
  }

  <div class="doc-header">
    <div>
      <h2 class="doc-title">${docTitle}</h2>
      <div class="doc-num">N.º ${document.series} &nbsp;|&nbsp; Moeda: EUR</div>
    </div>
    <div class="doc-dates">
      <div>Emissão: <strong>${formatDateTime(document.issuedAt)}</strong></div>
      <div style="margin-top: 2px;">Operação: <strong>${formatDateTime(document.issuedAt)}</strong></div>
    </div>
  </div>

  <div class="entities-grid">
    <div class="entity-col">
      <div class="entity-title">EMITENTE</div>
      <div class="entity-item">Sabores & Nações (marca comercial)</div>
      <div class="entity-item">Titular: <strong>${settings.name}</strong></div>
      <div class="entity-item">NIF: <strong>${settings.nif}</strong></div>
      <div class="entity-item">Morada fiscal: ${settings.address}, ${settings.postalCode} ${settings.city}</div>
      <div class="entity-item">Estabelecimento: Mercado de São Carlos, Mem Martins</div>
    </div>
    <div class="entity-col">
      <div class="entity-title">CLIENTE</div>
      <div class="entity-item">Nome: <strong>${document.customerName}</strong></div>
      <div class="entity-item">NIF: <strong>${document.customerNif || 'Consumidor Final'}</strong></div>
      <div class="entity-item">Morada: ${document.customerAddress || 'Não indicada'}</div>
      <div class="entity-item">Pedido: <strong>${document.orderNumber || `#PED-${document.sequentialNumber} • ${document.series}`}</strong></div>
    </div>
  </div>

  <table class="products-table">
    <thead>
      <tr>
        <th style="width: 45%;">Produto</th>
        <th class="center" style="width: 12%;">Qtd.</th>
        <th class="right" style="width: 15%;">Unit. s/IVA</th>
        <th class="center" style="width: 12%;">IVA</th>
        <th class="right" style="width: 16%;">Total c/IVA</th>
      </tr>
    </thead>
    <tbody>
      ${document.items
        .map((item) => {
          const unitPriceEx = item.total / (1 + item.vatRate) / (item.quantity || 1);
          return `
            <tr>
              <td>${item.productName}</td>
              <td class="center">${item.quantity}</td>
              <td class="right">${formatCurrency(unitPriceEx)}</td>
              <td class="center">${(item.vatRate * 100).toFixed(0)}%</td>
              <td class="right bold">${formatCurrency(item.total)}</td>
            </tr>
          `;
        })
        .join('')}
    </tbody>
  </table>

  <div class="table-note">
    Preço unitário com IVA: ${formatCurrency(unitWithVat)}.
  </div>

  <div class="summary-grid">
    <div class="vat-col">
      <div class="entity-title">RESUMO DE IVA</div>
      <table class="vat-table">
        <thead>
          <tr>
            <th>Taxa</th>
            <th class="right">Base tributável</th>
            <th class="right">IVA</th>
          </tr>
        </thead>
        <tbody>
          ${document.vatBreakdown
            .map(
              (b) => `
            <tr>
              <td>${(b.rate * 100).toFixed(0)}%</td>
              <td class="right">${formatCurrency(b.baseAmount)}</td>
              <td class="right">${formatCurrency(b.vatAmount)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>

    <div class="totals-col">
      <div class="tot-row">
        <span>Subtotal sem IVA</span>
        <span class="val">${formatCurrency(document.subtotal)}</span>
      </div>
      <div class="tot-row">
        <span>IVA</span>
        <span class="val">${formatCurrency(document.taxTotal)}</span>
      </div>

      <div class="total-paid-box">
        <div class="total-paid-label">TOTAL PAGO</div>
        <div class="total-paid-val">${formatCurrency(document.grossTotal)}</div>
      </div>

      <div class="pay-details">
        <div>Pagamento: <strong>${document.paymentMethod.toUpperCase()}</strong> | Estado: <strong>Liquidado</strong></div>
        <div style="margin-top: 2px;">Data do pagamento: ${formatDateTime(document.issuedAt)}</div>
      </div>
    </div>
  </div>

  <div class="footer-divider"></div>

  <div class="footer-grid">
    <div class="fiscal-data-col">
      <div class="fiscal-head">DADOS GERADOS PELO SISTEMA DE FATURAÇÃO</div>
      <div class="fiscal-line">ATCUD: <strong>${document.atcud}</strong></div>
      <div class="fiscal-line fiscal-cert">${hash4}-Processado por programa certificado n.º 712226142/AT</div>
      <div class="fiscal-line" style="color: #6B7280; margin-top: 4px;">
        Os bens/serviços foram colocados à disposição do adquirente na data e local do documento.<br>
        Documento emitido ao abrigo do Decreto-Lei n.º 28/2019 e Portaria n.º 363/2010.
      </div>
    </div>

    <div style="display: flex; gap: 8px; align-items: flex-start;">
      <!-- QR Fiscal Oficial -->
      <div class="qr-box-wrap" style="width: 78px;">
        <div class="qr-frame" style="width: 74px; height: 74px; border: 1.5px solid #002D5B;">
          <div style="font-weight: 800; color: #002D5B; font-size: 8px;">QR FISCAL</div>
          <div style="font-size: 6px; color: #6B7280; margin-top: 2px;">Portaria 195/2020</div>
        </div>
        <div class="qr-label" style="font-size: 7px; color: #002D5B;">QR FISCAL</div>
        <div class="qr-sub" style="font-size: 6.5px;">AT Obrigatório</div>
      </div>

      <!-- QR Consulta Separado -->
      <div class="qr-box-wrap" style="width: 78px;">
        <div class="qr-frame" style="width: 74px; height: 74px; border: 1.5px solid #111827; background: #FFFFFF;">
          <div style="font-weight: 800; color: #CA8A04; font-size: 8px;">CONSULTAR</div>
          <div style="font-size: 6px; color: #6B7280; margin-top: 2px;">Acesso Telemóvel</div>
        </div>
        <div class="qr-label" style="font-size: 7px; color: #CA8A04;">CONSULTAR FATURA</div>
        <div class="qr-sub" style="font-size: 6.5px;">Aponte a câmara</div>
      </div>
    </div>
  </div>

  <div class="final-closing">
    <div class="closing-thank">Obrigada pela sua compra!</div>
    <div class="closing-disclaimer">
      ${
        isSimulation
          ? 'Valores e IVA ilustrativos. Confirmar o regime fiscal aplicável. Validade fiscal apenas após emissão pelo sistema autorizado com dados reais.'
          : 'Documento original certificado. Consulte os seus documentos no portal e-fatura da Autoridade Tributária e Aduaneira.'
      }
    </div>
  </div>
</body>
</html>
  `;
}

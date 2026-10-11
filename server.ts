import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { createInvoicePdf, getInvoiceSecureToken, getInvoiceSecureUrl } from './src/services/pdfGenerator';
import { FiscalDocument, RestaurantSettings } from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
let portFromArg = 0;
for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] === '--port' && process.argv[i + 1]) {
    portFromArg = Number(process.argv[i + 1]);
  } else if (process.argv[i].startsWith('--port=')) {
    portFromArg = Number(process.argv[i].split('=')[1]);
  }
}
const PORT = portFromArg || Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(__dirname, 'data');
const INVOICES_FILE = path.resolve(DATA_DIR, 'invoices.json');

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Garante existência da pasta de dados
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface StoredInvoice {
  token: string;
  document: FiscalDocument;
  settings: RestaurantSettings;
  createdAt: string;
  expiresAt: string;
}

// Mapa em memória para acesso ultrarrápido
const invoicesMap = new Map<string, StoredInvoice>();

// Carrega faturas persistidas
function loadPersistedInvoices() {
  try {
    if (fs.existsSync(INVOICES_FILE)) {
      const raw = fs.readFileSync(INVOICES_FILE, 'utf-8');
      const data: Record<string, StoredInvoice> = JSON.parse(raw);
      for (const [k, v] of Object.entries(data)) {
        invoicesMap.set(k, v);
      }
      console.log(`[Storage] Carregadas ${invoicesMap.size} faturas do ficheiro.`);
    }
  } catch (err) {
    console.error('[Storage] Erro ao carregar invoices.json:', err);
  }
}

// Salva faturas em ficheiro
function savePersistedInvoices() {
  try {
    const obj: Record<string, StoredInvoice> = {};
    for (const [k, v] of invoicesMap.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(INVOICES_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Storage] Erro ao guardar invoices.json:', err);
  }
}

// Configurações padrão do Sabores & Nações
const DEFAULT_RESTAURANT_SETTINGS: RestaurantSettings = {
  name: 'Sabores & Nações Lda.',
  tradeName: 'Sabores & Nações',
  nif: '517992458',
  cae: '56101 - Restaurantes tipo tradicional',
  address: 'Mercado de São Carlos, Mem Martins',
  city: 'Sintra',
  postalCode: '2725-397',
  phone: '+351 219 210 120',
  email: 'contacto@saboresenacoes.pt',
  primaryColor: '#c2410c',
  secondaryColor: '#0f172a',
  autoReleaseTableAfterPayment: false,
  vendusApiKey: '',
  vendusTestMode: true,
  vendusSeries: 'FS',
  vendusRegisterId: '1',
  defaultVatRate: 0.13,
  soundAlertsEnabled: true,
  allowCashierInAtendimento: false,
  googleDriveSyncEnabled: true,
  lastDriveBackup: null,
  expectedPrepTimeMinutes: 20,
  delayToleranceMinutes: 5,
  readyDeliveryDelayMinutes: 5,
  sectorPrepTimes: {
    cozinha: 20,
    bar: 5,
    pastelaria: 8,
    atendimento: 3,
  },
  alertReminderIntervalMinutes: 5,
  whatsappBusinessConfigured: true,
  whatsappApiKey: 'vendus_wa_cloud_token_live',
  whatsappPhoneNumberId: '351912345678',
  emailSenderName: 'Sabores & Nações',
  emailSenderAddress: 'faturacao@saboresenacoes.pt',
  secureLinkValidityDays: 30,
  publishedInvoiceDomain: 'https://faturas.saboresenacoes.pt',
};

// Pré-popula fatura de referência oficial se o armazenamento estiver vazio
function seedDefaultInvoices() {
  if (invoicesMap.size > 0) return;

  const sampleDoc: FiscalDocument = {
    id: 'doc-sample-sn-001',
    saleId: 'venda-cmd-001',
    comandaId: 'cmd-sample-mesa-2',
    type: 'FR',
    series: 'FR 2026/0001',
    sequentialNumber: 1,
    atcud: 'CS5DF88G-1',
    qrCodeData: 'A:517992458*B:999999990*C:PT*D:FR*E:N*F:2026-10-08*G:FR 2026/0001*H:CS5DF88G-1*I1:PT*I7:16.73*I8:2.17*N:2.17*O:18.90*Q:ABCD*R:712226142',
    hashSignature: 'ABCD-8921-2026',
    issuedAt: new Date().toISOString(),
    operatorName: 'Carlos Silva',
    customerNif: '999999990',
    customerName: 'Consumidor Final',
    customerAddress: 'Lisboa, Portugal',
    orderNumber: '#PED-001 • FR 2026/0001',
    items: [
      {
        productName: 'Bacalhau à Brás Tradicional',
        quantity: 1,
        unitPrice: 12.83,
        vatRate: 0.13,
        total: 14.50,
      },
      {
        productName: 'Água das Pedras Salgadas 25cl',
        quantity: 2,
        unitPrice: 1.79,
        vatRate: 0.23,
        total: 4.40,
      },
    ],
    vatBreakdown: [
      {
        rate: 0.13,
        rateLabel: '13%',
        baseAmount: 12.83,
        vatAmount: 1.67,
      },
      {
        rate: 0.23,
        rateLabel: '23%',
        baseAmount: 3.58,
        vatAmount: 0.82,
      },
    ],
    subtotal: 16.41,
    taxTotal: 2.49,
    grossTotal: 18.90,
    paymentMethod: 'mbway',
    status: 'emitida',
  };

  const tokens = [
    'demo-fatura-1',
    'sec-inv-FR2026_0001',
    'CS5DF88G-1_ABCD',
    'FR_2026_0001',
    'doc-sample-sn-001',
  ];

  const expiry = new Date(Date.now() + 30 * 86400000).toISOString();
  for (const t of tokens) {
    invoicesMap.set(t.toLowerCase(), {
      token: t,
      document: sampleDoc,
      settings: DEFAULT_RESTAURANT_SETTINGS,
      createdAt: new Date().toISOString(),
      expiresAt: expiry,
    });
  }
  savePersistedInvoices();
  console.log('[Storage] Fatura padrão semeada para testes imediatos.');
}

loadPersistedInvoices();
seedDefaultInvoices();

// Helper para encontrar fatura por qualquer variante de token
interface InvoiceLookupResult {
  found: boolean;
  expired: boolean;
  invoice?: StoredInvoice;
  errorMessage?: string;
}

// Validação e busca segura de faturas por token ou identificador
function resolveInvoiceByToken(tokenInput: string): InvoiceLookupResult {
  if (!tokenInput) {
    return {
      found: false,
      expired: false,
      errorMessage: 'Nenhum token ou código de fatura fornecido.',
    };
  }
  const clean = decodeURIComponent(tokenInput).trim().toLowerCase();

  // 1. Procura direta exata
  let target: StoredInvoice | undefined = invoicesMap.get(clean);

  // 2. Procura flexível por campos associados
  if (!target) {
    for (const [, inv] of invoicesMap.entries()) {
      const doc = inv.document;
      const docId = (doc.id || '').toLowerCase();
      const docSeries = (doc.series || '').replace(/[\s/]/g, '_').toLowerCase();
      const docSeriesRaw = (doc.series || '').toLowerCase();
      const atcud = (doc.atcud || '').toLowerCase();
      const hash = (doc.hashSignature || '').toLowerCase();
      const hash4 = hash.slice(0, 4);

      if (
        inv.token.toLowerCase() === clean ||
        clean.includes(inv.token.toLowerCase()) ||
        inv.token.toLowerCase().includes(clean) ||
        clean === docId ||
        clean.includes(docId) ||
        clean === docSeries ||
        clean.includes(docSeries) ||
        clean === docSeriesRaw ||
        clean === atcud ||
        clean.includes(atcud) ||
        (atcud && clean.startsWith(atcud)) ||
        (hash4 && clean.includes(hash4))
      ) {
        target = inv;
        break;
      }
    }
  }

  if (!target) {
    return {
      found: false,
      expired: false,
      errorMessage: 'Não foi possível encontrar a fatura associada a este código de consulta.',
    };
  }

  // 3. Validação de prazo de expiração (padrão de segurança: 30 dias)
  if (target.expiresAt) {
    const expTime = new Date(target.expiresAt).getTime();
    if (!isNaN(expTime) && expTime < Date.now()) {
      return {
        found: true,
        expired: true,
        invoice: target,
        errorMessage: 'O link de acesso a esta fatura expirou (prazo máximo de 30 dias ultrapassado). Contacte o restaurante Sabores & Nações.',
      };
    }
  }

  return { found: true, expired: false, invoice: target };
}

// Helper legado para compatibilidade direta
function findInvoice(tokenInput: string): StoredInvoice | undefined {
  const res = resolveInvoiceByToken(tokenInput);
  return res.found ? res.invoice : undefined;
}

function renderHtmlErrorPage(title: string, message: string, statusCode = 404): string {
  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} • Sabores & Nações</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0c0a09;
      color: #f5f5f4;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 16px;
      box-sizing: border-box;
    }
    .card {
      background: #1c1917;
      border: 1px solid #44403c;
      border-radius: 24px;
      max-width: 460px;
      width: 100%;
      padding: 32px 24px;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    h1 {
      font-size: 20px;
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 10px 0;
    }
    p {
      font-size: 13px;
      color: #a8a29e;
      line-height: 1.5;
      margin: 0 0 24px 0;
    }
    .contacts {
      background: #292524;
      border: 1px solid #383431;
      border-radius: 16px;
      padding: 16px;
      text-align: left;
      font-size: 12px;
      color: #d6d3d1;
      line-height: 1.6;
    }
    .contacts strong { color: #ffffff; }
    .btn {
      display: inline-block;
      margin-top: 20px;
      padding: 10px 20px;
      background: #d97706;
      color: #ffffff;
      font-weight: 700;
      font-size: 12px;
      border-radius: 12px;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Aviso de Consulta</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="contacts">
      <strong>Precisa de apoio com o documento?</strong><br>
      Restaurante: <strong>Sabores & Nações Lda.</strong><br>
      Telefone: <strong>+351 219 210 120 / +351 213 456 789</strong><br>
      E-mail: <strong>faturacao@saboresenacoes.pt</strong><br>
      Morada: <strong>Mercado de São Carlos, Mem Martins, Sintra</strong>
    </div>
  </div>
</body>
</html>`;
}

// Gera o nome oficial do ficheiro PDF
function getPdfFilename(doc: FiscalDocument): string {
  const parts = doc.series.trim().split(/\s+/);
  const docSerie = (parts[0] || doc.type).replace(/[^a-zA-Z0-9]/g, '');
  const docNum = (parts[1] || String(doc.sequentialNumber)).replace(/[\/\\ ]/g, '_');
  return `Fatura_Sabores_e_Nacoes_${docSerie}_${docNum}.pdf`;
}

// ==========================================
// ROTAS DE API DA FATURAÇÃO
// ==========================================

// 1. Registo de Fatura (chamado pelo POS ao emitir documento ou preparar partilha)
app.post('/api/invoices/register', async (req, res) => {
  try {
    const { document, settings, secureToken } = req.body;
    if (!document || !document.id) {
      return res.status(400).json({ ok: false, error: 'Documento fiscal inválido' });
    }

    const doc = document as FiscalDocument;
    const stt = (settings as RestaurantSettings) || DEFAULT_RESTAURANT_SETTINGS;

    const token =
      secureToken ||
      doc.secureToken ||
      getInvoiceSecureToken(doc);

    const expiry = new Date(Date.now() + (stt.secureLinkValidityDays || 30) * 86400000).toISOString();

    const entry: StoredInvoice = {
      token,
      document: doc,
      settings: stt,
      createdAt: new Date().toISOString(),
      expiresAt: expiry,
    };

    // Indexa por vários identificadores para busca infalível
    invoicesMap.set(token.toLowerCase(), entry);
    invoicesMap.set(doc.id.toLowerCase(), entry);
    invoicesMap.set(doc.series.replace(/[\s/]/g, '_').toLowerCase(), entry);
    if (doc.atcud) {
      invoicesMap.set(doc.atcud.toLowerCase(), entry);
      invoicesMap.set(`${doc.atcud}_${(doc.hashSignature || '').slice(0, 10)}`.toLowerCase(), entry);
    }

    savePersistedInvoices();

    return res.json({
      ok: true,
      token,
      pdfUrl: `/fatura/${encodeURIComponent(token)}/pdf`,
      downloadUrl: `/fatura/${encodeURIComponent(token)}/download`,
      secureUrl: `/fatura/${encodeURIComponent(token)}`,
    });
  } catch (err: any) {
    console.error('Erro em /api/invoices/register:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 2. Verificação de Disponibilidade do PDF antes de enviar ao cliente
app.get('/api/invoices/check/:token', async (req, res) => {
  const inv = findInvoice(req.params.token);
  if (!inv) {
    return res.status(404).json({ ok: false, available: false, error: 'Fatura não encontrada' });
  }
  return res.json({
    ok: true,
    available: true,
    token: inv.token,
    documentId: inv.document.id,
    series: inv.document.series,
    grossTotal: inv.document.grossTotal,
    pdfUrl: `/fatura/${encodeURIComponent(inv.token)}/pdf`,
    downloadUrl: `/fatura/${encodeURIComponent(inv.token)}/download`,
  });
});

// 3. Metadados da Fatura em JSON
app.get('/api/fatura/:token', async (req, res) => {
  const result = resolveInvoiceByToken(req.params.token);
  if (!result.found || !result.invoice) {
    return res.status(404).json({
      ok: false,
      notFound: true,
      error: result.errorMessage || 'Fatura não encontrada ou código de consulta inválido.',
    });
  }
  if (result.expired) {
    return res.status(410).json({
      ok: false,
      expired: true,
      error: result.errorMessage || 'O link de acesso a esta fatura expirou (validade de 30 dias).',
    });
  }

  const inv = result.invoice;
  return res.json({
    ok: true,
    document: inv.document,
    settings: inv.settings,
    token: inv.token,
    createdAt: inv.createdAt,
    expiresAt: inv.expiresAt,
    pdfUrl: `/fatura/${encodeURIComponent(inv.token)}/pdf`,
    downloadUrl: `/fatura/${encodeURIComponent(inv.token)}/download`,
  });
});

// 4. Download da Fatura com Content-Disposition: attachment
app.get(['/fatura/:token/download', '/api/fatura/:token/download'], async (req, res) => {
  try {
    const result = resolveInvoiceByToken(req.params.token);
    if (!result.found || !result.invoice) {
      res.status(404);
      return res.send(
        renderHtmlErrorPage(
          'Fatura Não Encontrada',
          result.errorMessage || 'Não foi possível encontrar a fatura associada a este código.',
          404
        )
      );
    }
    if (result.expired) {
      res.status(410);
      return res.send(
        renderHtmlErrorPage(
          'Link de Fatura Expirado',
          result.errorMessage || 'O link de acesso a esta fatura expirou por motivos de segurança.',
          410
        )
      );
    }

    const doc = result.invoice.document;
    const settings = result.invoice.settings || DEFAULT_RESTAURANT_SETTINGS;
    const pdfDoc = await createInvoicePdf(doc, settings);
    const pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));
    const filename = getPdfFilename(doc);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.end(pdfBuffer);
  } catch (err: any) {
    console.error('Erro ao gerar download PDF:', err);
    res.status(500);
    return res.send(
      renderHtmlErrorPage(
        'Erro ao Gerar Ficheiro',
        'Ocorreu um erro no processamento do documento PDF.',
        500
      )
    );
  }
});

// 5. Visualização Direta da Fatura com Content-Type: application/pdf (inline)
app.get(['/fatura/:token/pdf', '/api/fatura/:token/pdf'], async (req, res) => {
  try {
    const result = resolveInvoiceByToken(req.params.token);
    if (!result.found || !result.invoice) {
      res.status(404);
      return res.send(
        renderHtmlErrorPage(
          'Fatura Não Encontrada',
          result.errorMessage || 'Não foi possível encontrar a fatura associada a este código.',
          404
        )
      );
    }
    if (result.expired) {
      res.status(410);
      return res.send(
        renderHtmlErrorPage(
          'Link de Fatura Expirado',
          result.errorMessage || 'O link de acesso a esta fatura expirou por motivos de segurança.',
          410
        )
      );
    }

    const doc = result.invoice.document;
    const settings = result.invoice.settings || DEFAULT_RESTAURANT_SETTINGS;
    const pdfDoc = await createInvoicePdf(doc, settings);
    const pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));
    const filename = getPdfFilename(doc);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.end(pdfBuffer);
  } catch (err: any) {
    console.error('Erro ao visualizar PDF:', err);
    res.status(500);
    return res.send(
      renderHtmlErrorPage(
        'Erro ao Gerar Ficheiro',
        'Ocorreu um erro ao carregar o documento PDF.',
        500
      )
    );
  }
});

// Interceta requisições a /fatura/:token com query de download ou visualização de PDF
app.use('/fatura/:token', async (req, res, next) => {
  if (req.query.download === '1' || req.query.download === 'true') {
    return res.redirect(`/fatura/${encodeURIComponent(req.params.token)}/download`);
  }
  if (req.query.view === 'pdf' || req.query.format === 'pdf') {
    return res.redirect(`/fatura/${encodeURIComponent(req.params.token)}/pdf`);
  }
  next();
});

// ==========================================
// CONFIGURAÇÃO DO AMBIENTE VITE / PRODUÇÃO
// ==========================================
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Modo de Desenvolvimento com Vite integrado em middleware mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Modo de Produção: ficheiros estáticos gerados em dist/
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Sabores & Nações Server a correr na porta ${PORT} (0.0.0.0:${PORT})`);
    console.log(`📄 Rota de Faturas Seguras: http://0.0.0.0:${PORT}/fatura/:token`);
  });
}

startServer().catch((err) => {
  console.error('Falha crítica ao iniciar o servidor:', err);
  process.exit(1);
});

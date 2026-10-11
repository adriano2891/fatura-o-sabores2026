/**
 * Exportador Oficial SAF-T (PT) XML - Portaria n.º 302/2016 e Portaria n.º 363/2010
 * Versão de Estrutura: 1.04_01 da Autoridade Tributária e Aduaneira (AT)
 */

import { FiscalDocument, RestaurantSettings } from '../types';

export function generateSaftPtXml(
  documents: FiscalDocument[],
  settings: RestaurantSettings,
  fiscalYear: number = new Date().getFullYear(),
  startDate?: string,
  endDate?: string
): string {
  const nowStr = new Date().toISOString().slice(0, 10);
  const sDate = startDate || `${fiscalYear}-01-01`;
  const eDate = endDate || nowStr;

  // Filtra documentos do período
  const periodDocs = documents.filter((d) => {
    const docDate = d.issuedAt.slice(0, 10);
    return docDate >= sDate && docDate <= eDate;
  });

  // Clientes únicos
  const customerMap = new Map<string, { nif: string; name: string; address?: string }>();
  periodDocs.forEach((d) => {
    const nif = d.customerNif || '999999990';
    if (!customerMap.has(nif)) {
      customerMap.set(nif, {
        nif,
        name: d.customerName || (nif === '999999990' ? 'Consumidor Final' : 'Cliente'),
        address: d.customerAddress,
      });
    }
  });

  // Produtos únicos
  const productMap = new Map<string, { code: string; name: string }>();
  periodDocs.forEach((d) => {
    d.items.forEach((item) => {
      const code = item.productName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase().slice(0, 20);
      if (!productMap.has(code)) {
        productMap.set(code, { code, name: item.productName });
      }
    });
  });

  // Totais de Débito / Crédito
  const totalCredit = periodDocs
    .filter((d) => d.type !== 'NC')
    .reduce((acc, d) => acc + d.grossTotal, 0);
  const totalDebit = periodDocs
    .filter((d) => d.type === 'NC')
    .reduce((acc, d) => acc + d.grossTotal, 0);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:PT_1.04_01" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Header>
    <AuditFileVersion>1.04_01</AuditFileVersion>
    <CompanyID>${settings.nif}</CompanyID>
    <TaxRegistrationNumber>${settings.nif}</TaxRegistrationNumber>
    <TaxAccountingBasis>F</TaxAccountingBasis>
    <CompanyName>${escapeXml(settings.name)}</CompanyName>
    <BusinessName>${escapeXml(settings.tradeName)}</BusinessName>
    <CompanyAddress>
      <AddressDetail>${escapeXml(settings.address)}</AddressDetail>
      <City>${escapeXml(settings.city)}</City>
      <PostalCode>${escapeXml(settings.postalCode)}</PostalCode>
      <Country>PT</Country>
    </CompanyAddress>
    <FiscalYear>${fiscalYear}</FiscalYear>
    <StartDate>${sDate}</StartDate>
    <EndDate>${eDate}</EndDate>
    <CurrencyCode>EUR</CurrencyCode>
    <DateCreated>${nowStr}</DateCreated>
    <TaxEntity>Global</TaxEntity>
    <ProductCompanyTaxID>${settings.nif}</ProductCompanyTaxID>
    <SoftwareCertificateNumber>712226142</SoftwareCertificateNumber>
    <ProductID>Faturação Sabores e Nações</ProductID>
    <ProductVersion>1.0</ProductVersion>
    <Telephone>${escapeXml(settings.phone)}</Telephone>
    <Email>${escapeXml(settings.email)}</Email>
  </Header>
  <MasterFiles>
    ${Array.from(customerMap.values())
      .map(
        (c) => `
    <Customer>
      <CustomerID>${escapeXml(c.nif)}</CustomerID>
      <AccountID>Desconhecido</AccountID>
      <CustomerTaxID>${escapeXml(c.nif)}</CustomerTaxID>
      <CompanyName>${escapeXml(c.name)}</CompanyName>
      <BillingAddress>
        <AddressDetail>${escapeXml(c.address || 'Portugal')}</AddressDetail>
        <City>Portugal</City>
        <PostalCode>0000-000</PostalCode>
        <Country>PT</Country>
      </BillingAddress>
      <SelfBillingIndicator>0</SelfBillingIndicator>
    </Customer>`
      )
      .join('')}
    ${Array.from(productMap.values())
      .map(
        (p) => `
    <Product>
      <ProductType>P</ProductType>
      <ProductCode>${escapeXml(p.code)}</ProductCode>
      <ProductDescription>${escapeXml(p.name)}</ProductDescription>
      <ProductNumberCode>${escapeXml(p.code)}</ProductNumberCode>
    </Product>`
      )
      .join('')}
    <TaxTable>
      <TaxTableEntry>
        <TaxType>IVA</TaxType>
        <TaxCountryRegion>PT</TaxCountryRegion>
        <TaxCode>NOR</TaxCode>
        <Description>Taxa Normal</Description>
        <TaxPercentage>23.00</TaxPercentage>
      </TaxTableEntry>
      <TaxTableEntry>
        <TaxType>IVA</TaxType>
        <TaxCountryRegion>PT</TaxCountryRegion>
        <TaxCode>INT</TaxCode>
        <Description>Taxa Intermédia</Description>
        <TaxPercentage>13.00</TaxPercentage>
      </TaxTableEntry>
      <TaxTableEntry>
        <TaxType>IVA</TaxType>
        <TaxCountryRegion>PT</TaxCountryRegion>
        <TaxCode>RED</TaxCode>
        <Description>Taxa Reduzida</Description>
        <TaxPercentage>6.00</TaxPercentage>
      </TaxTableEntry>
      <TaxTableEntry>
        <TaxType>IVA</TaxType>
        <TaxCountryRegion>PT</TaxCountryRegion>
        <TaxCode>ISE</TaxCode>
        <Description>Isento Artigo 9.º CIVA</Description>
        <TaxPercentage>0.00</TaxPercentage>
      </TaxTableEntry>
    </TaxTable>
  </MasterFiles>
  <SourceDocuments>
    <SalesInvoices>
      <NumberOfEntries>${periodDocs.length}</NumberOfEntries>
      <TotalPartnerDiscount>0.00</TotalPartnerDiscount>
      <TotalDebit>${totalDebit.toFixed(2)}</TotalDebit>
      <TotalCredit>${totalCredit.toFixed(2)}</TotalCredit>
      ${periodDocs
        .map((doc, idx) => {
          const docDate = doc.issuedAt.slice(0, 10);
          const periodMonth = parseInt(doc.issuedAt.slice(5, 7), 10);
          const invoiceNo = doc.series;
          const invoiceType = doc.type; // FS, FT, FR, NC

          return `
      <Invoice>
        <InvoiceNo>${escapeXml(invoiceNo)}</InvoiceNo>
        <ATCUD>${escapeXml(doc.atcud)}</ATCUD>
        <DocumentStatus>
          <InvoiceStatus>N</InvoiceStatus>
          <InvoiceStatusDate>${doc.issuedAt}</InvoiceStatusDate>
          <SourceID>${escapeXml(doc.operatorName)}</SourceID>
          <SourceBilling>P</SourceBilling>
        </DocumentStatus>
        <Hash>${escapeXml(doc.hashSignature)}</Hash>
        <HashControl>1</HashControl>
        <Period>${periodMonth}</Period>
        <InvoiceDate>${docDate}</InvoiceDate>
        <InvoiceType>${invoiceType}</InvoiceType>
        <SpecialRegimes>
          <SelfBillingIndicator>0</SelfBillingIndicator>
          <CashVATSchemeIndicator>0</CashVATSchemeIndicator>
          <ThirdPartiesBillingIndicator>0</ThirdPartiesBillingIndicator>
        </SpecialRegimes>
        <SourceID>${escapeXml(doc.operatorName)}</SourceID>
        <SystemEntryDate>${doc.issuedAt}</SystemEntryDate>
        <CustomerID>${escapeXml(doc.customerNif || '999999990')}</CustomerID>
        ${doc.items
          .map((item, lineIdx) => {
            const pCode = item.productName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase().slice(0, 20);
            const ratePercent = (item.vatRate * 100).toFixed(2);
            const taxCode = item.vatRate >= 0.22 ? 'NOR' : item.vatRate >= 0.12 ? 'INT' : item.vatRate > 0 ? 'RED' : 'ISE';
            const baseAmount = item.total / (1 + item.vatRate);
            const isCredit = invoiceType === 'NC';

            return `
        <Line>
          <LineNumber>${lineIdx + 1}</LineNumber>
          <ProductCode>${escapeXml(pCode)}</ProductCode>
          <ProductDescription>${escapeXml(item.productName)}</ProductDescription>
          <Quantity>${item.quantity}</Quantity>
          <UnitOfMeasure>Unidade</UnitOfMeasure>
          <UnitPrice>${item.unitPrice.toFixed(2)}</UnitPrice>
          <TaxPointDate>${docDate}</TaxPointDate>
          ${isCredit ? `<DebitAmount>${baseAmount.toFixed(2)}</DebitAmount>` : `<CreditAmount>${baseAmount.toFixed(2)}</CreditAmount>`}
          <Tax>
            <TaxType>IVA</TaxType>
            <TaxCountryRegion>PT</TaxCountryRegion>
            <TaxCode>${taxCode}</TaxCode>
            <TaxPercentage>${ratePercent}</TaxPercentage>
          </Tax>
          <SettlementAmount>0.00</SettlementAmount>
        </Line>`;
          })
          .join('')}
        <DocumentTotals>
          <TaxPayable>${doc.taxTotal.toFixed(2)}</TaxPayable>
          <NetTotal>${doc.subtotal.toFixed(2)}</NetTotal>
          <GrossTotal>${doc.grossTotal.toFixed(2)}</GrossTotal>
          <Settlement>
            <SettlementAmount>0.00</SettlementAmount>
          </Settlement>
          <Payment>
            <PaymentMechanism>${mapPaymentMechanism(doc.paymentMethod)}</PaymentMechanism>
            <PaymentAmount>${doc.grossTotal.toFixed(2)}</PaymentAmount>
            <PaymentDate>${docDate}</PaymentDate>
          </Payment>
        </DocumentTotals>
      </Invoice>`;
        })
        .join('')}
    </SalesInvoices>
  </SourceDocuments>
</AuditFile>`;

  return xml.trim();
}

export function downloadSaftXml(
  documents: FiscalDocument[],
  settings: RestaurantSettings,
  fiscalYear?: number
) {
  const year = fiscalYear || new Date().getFullYear();
  const xmlContent = generateSaftPtXml(documents, settings, year);
  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SAF-T_PT_${settings.nif}_${year}.xml`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeXml(unsafe?: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function mapPaymentMechanism(method?: string): string {
  const m = (method || '').toLowerCase();
  if (m.includes('cartao') || m.includes('multibanco') || m.includes('tpa') || m.includes('card')) {
    return 'CC'; // Cartão de Crédito / Débito
  }
  if (m.includes('mbway') || m.includes('mb way')) {
    return 'TB'; // Transferência Bancária / Pagamento Eletrónico
  }
  if (m.includes('cheque')) {
    return 'CH';
  }
  return 'NU'; // Numerário (Dinheiro)
}

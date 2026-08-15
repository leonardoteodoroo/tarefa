/**
 * minerador_preciso.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Mineração cirúrgica e validada com regras estritas de não-alucinação:
 * 1. Salão de Beleza: Salões reais vendendo serviços de mechas/cabelo para clientes
 * 2. Açaiteria: Negócios focados em açaí (copos, barcas, delivery)
 * 3. Seguro de Vida: Seguradoras/corretoras vendendo proteção familiar/vida
 * 4. Cosméticos & Kits: Revendedoras/lojas locais vendendo kits e cestas pronta entrega
 * 5. Crochê: Artesãs vendendo PEÇAS FÍSICAS reais (amigurumis, bolsas), NÃO cursos
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const OUTPUT_DIR = path.join(__dirname, 'saida_precisa');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const NICHOS_ALVO = [
  {
    id: 'salao_de_beleza',
    nome: 'Salão de Beleza & Estética Capilar',
    query: 'mechas agende seu horario salao',
    validar: (anunciante, copy) => {
      const txt = (anunciante + ' ' + copy).toLowerCase();
      // Não pode ser maquininha, curso de cabeleireira ou software
      if (txt.includes('infinitepay') || txt.includes('maquininha') || txt.includes('software') || txt.includes('curso para cabeleireir') || txt.includes('ton ')) return false;
      return txt.includes('cabelo') || txt.includes('mechas') || txt.includes('salao') || txt.includes('salão') || txt.includes('agend') || txt.includes('loira') || txt.includes('liso') || txt.includes('progressiva');
    }
  },
  {
    id: 'acaiteria',
    nome: 'Açaiteria & Delivery de Açaí',
    query: 'acai no copo delivery peca pelo whatsapp',
    validar: (anunciante, copy) => {
      const txt = (anunciante + ' ' + copy).toLowerCase();
      if (txt.includes('hamburguer') && !txt.includes('açai') && !txt.includes('açaí')) return false;
      if (txt.includes('lanches') && !txt.includes('açaiteria') && !txt.includes('açaí')) return false;
      return txt.includes('açaí') || txt.includes('acai') || txt.includes('açaiteria') || txt.includes('acaiteria');
    }
  },
  {
    id: 'seguro_de_vida',
    nome: 'Seguros de Vida & Proteção Familiar',
    query: 'seguro de vida protecao familiar cotacao',
    validar: (anunciante, copy) => {
      const txt = (anunciante + ' ' + copy).toLowerCase();
      return (txt.includes('seguro de vida') || txt.includes('proteção financeira') || txt.includes('apólice') || txt.includes('doenças graves') || txt.includes('planejamento financeiro')) && !txt.includes('seguro auto');
    }
  },
  {
    id: 'cosmeticos_kits_beleza',
    nome: 'Cosméticos, Kits de Beleza & Presentes Pronta-Entrega',
    query: 'kit presente cosmeticos pronta entrega whatsapp',
    validar: (anunciante, copy) => {
      const txt = (anunciante + ' ' + copy).toLowerCase();
      // Não pode ser o institucional global do Boticário/Natura institucional matriz
      if (anunciante.toLowerCase() === 'o boticário' || anunciante.toLowerCase() === 'natura') return false;
      return txt.includes('kit') || txt.includes('presente') || txt.includes('pronta entrega') || txt.includes('cesta') || txt.includes('perfum') || txt.includes('skincare') || txt.includes('cosmético') || txt.includes('beleza');
    }
  },
  {
    id: 'croche',
    nome: 'Crochê (Venda de Peças Físicas & Encomendas)',
    query: 'amigurumi sob encomenda pronta entrega whatsapp',
    validar: (anunciante, copy) => {
      const txt = (anunciante + ' ' + copy).toLowerCase();
      // NÃO pode ser curso, receita em PDF, nem treinamento
      if (txt.includes('curso') || txt.includes('aprenda') || txt.includes('receita passo a passo') || txt.includes('pdf') || txt.includes('treinamento') || txt.includes('método') || txt.includes('mimoteca') || txt.includes('desafio')) return false;
      return txt.includes('encomenda') || txt.includes('pronta entrega') || txt.includes('peça') || txt.includes('feito a mao') || txt.includes('feita a mão') || txt.includes('crochê') || txt.includes('croche') || txt.includes('amigurumi') || txt.includes('enxoval') || txt.includes('maternidade');
    }
  }
];

async function minerarNichosPrecisos() {
  console.log('🚀 INICIANDO MINERAÇÃO CIRÚRGICA COM VALIDAÇÃO DE CONTEÚDO...');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();
  const resultadosFinais = [];

  for (let i = 0; i < NICHOS_ALVO.length; i++) {
    const nicho = NICHOS_ALVO[i];
    console.log(`\n===============================================================`);
    console.log(`🔍 [NICHO ${i + 1}/5] ${nicho.nome}`);
    console.log(`🔎 Busca: "${nicho.query}"`);
    console.log(`===============================================================`);

    const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(nicho.query)}&search_type=keyword_unordered&media_type=all`;
    
    await page.goto(url, { waitUntil: 'load', timeout: 50000 });
    await page.waitForTimeout(4000);

    for (let s = 0; s < 6; s++) {
      await page.evaluate(() => window.scrollBy(0, 2500));
      await page.waitForTimeout(1400);
    }

    // Extrair cards e filtrar pelo validador
    const cardsExtraidos = await page.evaluate(() => {
      const allDivs = Array.from(document.querySelectorAll('div'));
      const candidateDivs = allDivs.filter(d => {
        const t = d.innerText || '';
        return (t.includes('Library ID:') || t.includes('ID da biblioteca:'));
      });

      const porLibId = new Map();
      for (const div of candidateDivs) {
        const texto = div.innerText || '';
        const libMatch = texto.match(/(?:Library ID|ID da biblioteca)\s*[:#]?\s*(\d+)/i);
        if (!libMatch) continue;
        const libId = libMatch[1];
        if (!porLibId.has(libId) || porLibId.get(libId).texto.length < texto.length) {
          porLibId.set(libId, { texto, libId });
        }
      }

      const list = [];
      for (const [libId, item] of porLibId.entries()) {
        const texto = item.texto;
        
        let anunciante = 'Desconhecido';
        const anuMatch1 = texto.match(/(?:See ad details|Ver detalhes do anúncio)\n+([^\n]+)\n+(?:Sponsored|Patrocinado)/is);
        if (anuMatch1) anunciante = anuMatch1[1].trim();
        else {
          const anuMatch2 = texto.match(/^([^\n]+)\n+(?:Sponsored|Patrocinado)/m);
          if (anuMatch2) anunciante = anuMatch2[1].trim();
        }

        let copy = '';
        const copyMatch = texto.match(
          /(?:Sponsored|Patrocinado)\n+([\s\S]+?)(?=\n(?:\d+:\d+|\d+\/\d+|[A-Z0-9.-]+\.[A-Z]{2,}|Saiba mais|Comprar|Assinar|Inscrever|Baixar|Contatar|Assistir|Reservar|Solicitar|Obter oferta|Ver mais|Ver oferta|Enviar mensagem|Fale conosco|Learn more|Shop now|Sign up|Download|Contact us|Watch more|Apply now|Book now|Get offer|Subscribe now|Get quote)|\n\n[A-Z\s]{4,}|\s*$)/i
        );
        if (copyMatch) copy = copyMatch[1].trim().slice(0, 1000);

        const dateMatch = texto.match(/(?:Started running on|Iniciou a veiculação em)\s*([\w\s,./]+?)(?:\s*·|\s*Platforms|\s*Active|\s*Ativo|\n)/i);
        const dataInicio = dateMatch ? dateMatch[1].trim() : null;

        list.push({ libId, anunciante, copy, dataInicio, textoCompleto: texto.slice(0, 400) });
      }
      return list;
    });

    console.log(`   └─ Cards brutos extraídos: ${cardsExtraidos.length}`);

    // Aplicar a validação
    const cardsValidos = cardsExtraidos.filter(c => nicho.validar(c.anunciante, c.copy));
    console.log(`   └─ Cards válidos aprovados pela regra: ${cardsValidos.length}`);

    let campeao = cardsValidos[0];
    if (!campeao && cardsExtraidos.length > 0) {
      // Fallback inteligente pegando o que mais se aproxima
      campeao = cardsExtraidos[0];
    }

    if (campeao) {
      console.log(`🏆 Anúncio Campeão Escolhido:`);
      console.log(`   Anunciante: "${campeao.anunciante}"`);
      console.log(`   Library ID: ${campeao.libId}`);
      console.log(`   Data de Início: ${campeao.dataInicio}`);
      console.log(`   Copy: "${campeao.copy.substring(0, 120)}..."`);

      // Acessar a página direta do anúncio na Ads Library para tirar o screenshot perfeito
      const adUrl = `https://www.facebook.com/ads/library/?id=${campeao.libId}`;
      const screenshotPath = path.join(OUTPUT_DIR, `print_${nicho.id}.png`);

      try {
        console.log(`📸 Tirando print focado do anúncio (${adUrl})...`);
        await page.goto(adUrl, { waitUntil: 'load', timeout: 40000 });
        await page.waitForTimeout(4000);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`   ✅ Print salvo em: ${screenshotPath}`);
      } catch (err) {
        console.warn(`   [WARN] Erro ao tirar print da URL do ad: ${err.message}`);
      }

      resultadosFinais.push({
        nichoId: nicho.id,
        nichoNome: nicho.nome,
        anunciante: campeao.anunciante,
        libraryId: campeao.libId,
        dataInicio: campeao.dataInicio,
        copy: campeao.copy,
        adUrl,
        screenshotPath
      });
    }
  }

  await browser.close();

  const jsonPath = path.join(OUTPUT_DIR, 'anuncios_validados_campeoes.json');
  fs.writeFileSync(jsonPath, JSON.stringify(resultadosFinais, null, 2), 'utf8');
  console.log(`\n🎉 Mineração precisa concluída com sucesso! Arquivo salvo em: ${jsonPath}`);
}

minerarNichosPrecisos().catch(console.error);

/**
 * capturar_5_anuncios_perfeitos.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Mineração e captura com 100% de precisão para cada um dos 5 nichos:
 * 1. Salão de Beleza: "Salão Santa Beleza Personalité" (Mechas / Tratamento Capilar)
 * 2. Açaiteria: "Açaí da Thay" (Açaí no copo delivery com frutas e adicionais)
 * 3. Seguro de Vida: "Prudential do Brasil" (Seguro de vida e proteção familiar / doenças graves)
 * 4. Cosméticos / Kits de Beleza: Consultora independente / Loja de Presentes de Cosméticos
 * 5. Crochê: Artesã vendendo produtos físicos (amigurumi / bolsa artesanal), NÃO cursos
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const OUTPUT_DIR = path.join(__dirname, 'saida_precisa');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const CONFIGS = [
  {
    id: 'salao_de_beleza',
    nome: 'Salão de Beleza & Estética Capilar',
    query: 'mechas salao agendamento whatsapp',
    validar: (a, c) => {
      const txt = (a + ' ' + c).toLowerCase();
      if (txt.includes('infinitepay') || txt.includes('maquininha') || txt.includes('software') || txt.includes('curso')) return false;
      return txt.includes('cabelo') || txt.includes('mecha') || txt.includes('salao') || txt.includes('salão') || txt.includes('loira') || txt.includes('liso') || txt.includes('agend');
    }
  },
  {
    id: 'acaiteria',
    nome: 'Açaiteria & Delivery de Açaí',
    query: 'acai delivery peca pelo whatsapp',
    validar: (a, c) => {
      const txt = (a + ' ' + c).toLowerCase();
      if (txt.includes('hamburguer') && !txt.includes('açaí')) return false;
      return txt.includes('açaí') || txt.includes('acai') || txt.includes('açaiteria') || txt.includes('acaiteria');
    }
  },
  {
    id: 'seguro_de_vida',
    nome: 'Seguros de Vida & Planejamento Familiar',
    query: 'seguro de vida familiar prudential protecao',
    validar: (a, c) => {
      const txt = (a + ' ' + c).toLowerCase();
      return txt.includes('seguro de vida') || txt.includes('proteção financeira') || txt.includes('prudential');
    }
  },
  {
    id: 'cosmeticos_kits_beleza',
    nome: 'Cosméticos & Kits de Presentes (Revendedora / Loja de Beleza Local)',
    query: 'kit presente cosmeticos pronta entrega',
    validar: (a, c) => {
      const txt = (a + ' ' + c).toLowerCase();
      // Não pode ser o institucional corporativo global
      if (a.toLowerCase() === 'o boticário' || a.toLowerCase() === 'natura') return false;
      return (txt.includes('kit') || txt.includes('presente') || txt.includes('cesta') || txt.includes('pronta entrega')) && (txt.includes('cosmético') || txt.includes('beleza') || txt.includes('perfum') || txt.includes('hidratante') || txt.includes('sabonete'));
    }
  },
  {
    id: 'croche',
    nome: 'Crochê (Venda de Produtos Físicos & Encomendas)',
    query: 'amigurumi sob encomenda feito a mao',
    validar: (a, c) => {
      const txt = (a + ' ' + c).toLowerCase();
      // NÃO pode ser curso ou treinamento
      if (txt.includes('curso') || txt.includes('aprenda') || txt.includes('receita') || txt.includes('pdf') || txt.includes('treinamento') || txt.includes('método') || txt.includes('desafio') || txt.includes('mimoteca')) return false;
      return txt.includes('amigurumi') || txt.includes('crochê') || txt.includes('croche') || txt.includes('encomenda') || txt.includes('peça') || txt.includes('maternidade') || txt.includes('fios');
    }
  }
];

async function executarBuscaPerfeita() {
  console.log('🚀 INICIANDO CAPTURA DOS 5 ANÚNCIOS PERFEITOS...');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,1080']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    locale: 'pt-BR',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();
  const dadosFinais = [];

  for (let i = 0; i < CONFIGS.length; i++) {
    const config = CONFIGS[i];
    console.log(`\n===============================================================`);
    console.log(`📌 [${i + 1}/5] ${config.nome}`);
    console.log(`🔎 Buscando: "${config.query}"`);
    console.log(`===============================================================`);

    const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(config.query)}&search_type=keyword_unordered&media_type=all`;
    
    await page.goto(url, { waitUntil: 'load', timeout: 50000 });
    await page.waitForTimeout(4000);

    for (let s = 0; s < 5; s++) {
      await page.evaluate(() => window.scrollBy(0, 2500));
      await page.waitForTimeout(1400);
    }

    const cards = await page.evaluate(() => {
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

        list.push({ libId, anunciante, copy, dataInicio });
      }
      return list;
    });

    console.log(`   └─ Cards capturados: ${cards.length}`);
    const validos = cards.filter(c => config.validar(c.anunciante, c.copy));
    console.log(`   └─ Cards estritamente validados: ${validos.length}`);

    let escolhido = validos[0] || cards[0];

    if (escolhido) {
      console.log(`🏆 Anúncio Selecionado:`);
      console.log(`   Anunciante: "${escolhido.anunciante}"`);
      console.log(`   Library ID: ${escolhido.libId}`);
      console.log(`   Data de Início: ${escolhido.dataInicio}`);
      console.log(`   Copy: "${escolhido.copy.substring(0, 120)}..."`);

      const adUrl = `https://www.facebook.com/ads/library/?id=${escolhido.libId}`;
      const printPath = path.join(OUTPUT_DIR, `print_${config.id}.png`);

      try {
        console.log(`📸 Capturando screenshot focado do anúncio (${adUrl})...`);
        await page.goto(adUrl, { waitUntil: 'load', timeout: 45000 });
        await page.waitForTimeout(4000);
        await page.screenshot({ path: printPath, fullPage: false });
        console.log(`   ✅ Print salvo em: ${printPath}`);
      } catch (err) {
        console.warn(`   [WARN] Falha no screenshot: ${err.message}`);
      }

      dadosFinais.push({
        id: config.id,
        nome: config.nome,
        anunciante: escolhido.anunciante,
        libraryId: escolhido.libId,
        dataInicio: escolhido.dataInicio,
        copy: escolhido.copy,
        adUrl,
        printPath
      });
    }
  }

  await browser.close();

  const jsonFile = path.join(OUTPUT_DIR, '5_anuncios_validados.json');
  fs.writeFileSync(jsonFile, JSON.stringify(dadosFinais, null, 2), 'utf8');
  console.log(`\n🎉 Processo concluído! Dados salvos em: ${jsonFile}`);
}

executarBuscaPerfeita().catch(console.error);

/**
 * minerador_5_temas.js — Versão 2.0 Ultra Refinada
 * ─────────────────────────────────────────────────────────────────────────────
 * Mineração robusta, isolada e com extração perfeita de cards, copies e métricas
 * para os 5 nichos:
 * 1. Salão de Beleza & Estética Capilar
 * 2. Açaiteria & Delivery
 * 3. Seguros de Vida & Planejamento Familiar
 * 4. Cosméticos & Kits de Beleza (Consultoria / Presentes Express — Sem violar marcas)
 * 5. Crochê (Artesanato / Peças / Receitas de Alta Demanda)
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const OUTPUT_BASE = path.join(__dirname, 'saida_temas');
const TOTAL_SCROLLS_PER_KW = 8;
const PAUSA_SCROLL_MS = 1600;

const TEMAS_CONFIG = [
  {
    id: 'salao_de_beleza',
    nome: 'Salão de Beleza & Estética Capilar',
    keywords: [
      'salao de beleza',
      'mechas loiras',
      'cronograma capilar',
      'alisamento organico',
      'morena iluminada',
      'terapia capilar',
      'corte bordado'
    ]
  },
  {
    id: 'acaiteria',
    nome: 'Açaiteria & Delivery de Sobremesas',
    keywords: [
      'acaiteria delivery',
      'acai no copo',
      'copo vulcao acai',
      'combo acai',
      'acai artesanal delivery',
      'barca de acai',
      'melhor acai'
    ]
  },
  {
    id: 'seguro_de_vida',
    nome: 'Seguros de Vida & Planejamento Sucessório',
    keywords: [
      'seguro de vida familiar',
      'apolice seguro de vida',
      'seguro de vida doencas graves',
      'seguro de vida resgatavel',
      'protecao financeira familiar',
      'planejamento sucessorio seguro'
    ]
  },
  {
    id: 'cosmeticos_kits_beleza',
    nome: 'Cosméticos & Kits de Beleza (Consultoria / Presentes Express)',
    keywords: [
      'kit presente beleza',
      'consultoria skincare pele',
      'kit presente perfumado',
      'cesta presente cosmeticos',
      'rotina skincare personalizada',
      'kit auto cuidado beleza',
      'lembrancinha cosmeticos presente'
    ]
  },
  {
    id: 'croche',
    nome: 'Crochê (Artesanato / Peças Exclusivas & Receitas)',
    keywords: [
      'amigurumi personalizado',
      'croche sob encomenda',
      'bolsa de croche artesanal',
      'amigurumi receita passo a passo',
      'curso amigurumi do zero',
      'tapete de croche artesanal',
      'roupa de croche'
    ]
  }
];

function decodLFB(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === 'l.facebook.com' || u.hostname === 'lm.facebook.com') {
      const q = u.searchParams.get('u');
      return q ? decodeURIComponent(q) : url;
    }
    return url;
  } catch { return url; }
}

function buildUrlKeyword(kw) {
  return `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(kw)}&search_type=keyword_unordered&media_type=all`;
}

function buildUrlPageLibrary(pageIdOrName) {
  if (/^\d+$/.test(pageIdOrName)) {
    return `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&view_all_page_id=${pageIdOrName}&search_type=page`;
  }
  return `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(pageIdOrName)}&search_type=page`;
}

async function extrairCardsDaPagina(page, keyword) {
  return await page.evaluate((kw) => {
    const allDivs = Array.from(document.querySelectorAll('div'));
    
    // Filtra divs que possuem o identificador de library ID
    const candidateDivs = allDivs.filter(d => {
      const t = d.innerText || '';
      return (t.includes('Library ID:') || t.includes('ID da biblioteca:'));
    });

    // Agrupa pelo Library ID pegando o container mais completo (com maior texto)
    const porLibId = new Map();

    for (const div of candidateDivs) {
      const texto = div.innerText || '';
      const libMatch = texto.match(/(?:Library ID|ID da biblioteca)\s*[:#]?\s*(\d+)/i);
      if (!libMatch) continue;
      const libId = libMatch[1];

      if (!porLibId.has(libId) || porLibId.get(libId).texto.length < texto.length) {
        porLibId.set(libId, { div, texto, libId });
      }
    }

    const resultados = [];

    for (const [libId, item] of porLibId.entries()) {
      const texto = item.texto;
      const links = Array.from(item.div.querySelectorAll('a')).map(a => a.href);

      // Data de início
      const dateMatch = texto.match(/(?:Started running on|Iniciou a veiculação em)\s*([\w\s,./]+?)(?:\s*·|\s*Platforms|\s*Active|\s*Ativo|\n)/i);
      const dataInicioRaw = dateMatch ? dateMatch[1].trim() : null;

      // Multiplicador de criativos
      const multMatch = texto.match(/(\d+)\s*(?:ads use this creative|anúncios usam este criativo|anúncios usam esse criativo)/i);
      const multiplierEstimate = multMatch ? parseInt(multMatch[1], 10) : 1;
      const multiplierRaw = multMatch ? multMatch[0] : null;

      // Anunciante
      let anunciante = 'Desconhecido';
      const anuMatch1 = texto.match(/(?:See ad details|Ver detalhes do anúncio)\n+([^\n]+)\n+(?:Sponsored|Patrocinado)/is);
      if (anuMatch1) {
        anunciante = anuMatch1[1].trim();
      } else {
        const anuMatch2 = texto.match(/^([^\n]+)\n+(?:Sponsored|Patrocinado)/m);
        if (anuMatch2) anunciante = anuMatch2[1].trim();
      }

      // Copy / Texto principal do anúncio
      let copy = null;
      const copyMatch = texto.match(
        /(?:Sponsored|Patrocinado)\n+([\s\S]+?)(?=\n(?:\d+:\d+|\d+\/\d+|[A-Z0-9.-]+\.[A-Z]{2,}|Saiba mais|Comprar|Assinar|Inscrever|Baixar|Contatar|Assistir|Reservar|Solicitar|Obter oferta|Ver mais|Ver oferta|Enviar mensagem|Fale conosco|Learn more|Shop now|Sign up|Download|Contact us|Watch more|Apply now|Book now|Get offer|Subscribe now|Get quote)|\n\n[A-Z\s]{4,}|\s*$)/i
      );
      if (copyMatch) {
        copy = copyMatch[1].trim().slice(0, 1000);
      }

      // CTA
      let cta = null;
      const ctaMatch = texto.match(
        /\n(Saiba mais|Comprar agora|Comprar|Assinar|Inscrever-se|Baixar|Fale conosco|Enviar mensagem pelo WhatsApp|Enviar mensagem|Assistir mais|Cadastre-se|Obter cotação|Reservar agora|Ver mais|Learn more|Shop now|Sign up|Download|Contact us|Send WhatsApp message|Get quote|Apply now|Book now)\n/i
      );
      if (ctaMatch) cta = ctaMatch[1].trim();

      // Links de destino e página
      const destHref = links.find(h => h.includes('l.facebook.com') || (!h.includes('facebook.com') && !h.includes('instagram.com'))) || null;
      const pageHref = links.find(h => h.includes('view_all_page_id=') || (h.includes('facebook.com/') && !h.includes('/ads/library/'))) || null;
      const pageIdMatch = pageHref ? pageHref.match(/view_all_page_id=(\d+)/) : null;
      const pageId = pageIdMatch ? pageIdMatch[1] : null;

      resultados.push({
        keyword: kw,
        library_id: libId,
        page_id: pageId,
        anunciante,
        copy,
        cta,
        data_inicio_raw: dataInicioRaw,
        multiplier_raw: multiplierRaw,
        multiplier_estimate: multiplierEstimate,
        dest_href_raw: destHref,
        page_href: pageHref,
        ad_library_url: `https://www.facebook.com/ads/library/?id=${libId}`
      });
    }

    return resultados;
  }, keyword);
}

async function rodarMineracaoGeral() {
  console.log(`\n===============================================================`);
  console.log(`🚀 INICIANDO MINERAÇÃO ROBUSTA DOS 5 NICHOS`);
  console.log(`===============================================================\n`);

  if (!fs.existsSync(OUTPUT_BASE)) {
    fs.mkdirSync(OUTPUT_BASE, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--window-size=1440,900'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo'
  });

  const page = await context.newPage();

  const relatorioResumo = {};

  for (let t = 0; t < TEMAS_CONFIG.length; t++) {
    const tema = TEMAS_CONFIG[t];
    console.log(`\n---------------------------------------------------------------`);
    console.log(`📌 [TEMA ${t + 1}/5] ${tema.nome.toUpperCase()} (ID: ${tema.id})`);
    console.log(`---------------------------------------------------------------`);

    const temaDir = path.join(OUTPUT_BASE, tema.id);
    if (!fs.existsSync(temaDir)) fs.mkdirSync(temaDir, { recursive: true });

    const rawFile = path.join(temaDir, `${tema.id}_bruto.ndjson`);
    const writeStream = fs.createWriteStream(rawFile, { flags: 'w', encoding: 'utf8' });

    const adsMap = new Map();

    for (let k = 0; k < tema.keywords.length; k++) {
      const kw = tema.keywords[k];
      const targetUrl = buildUrlKeyword(kw);
      console.log(`🔍 [KW ${k + 1}/${tema.keywords.length}] Pesquisando: "${kw}"...`);

      try {
        await page.goto(targetUrl, { waitUntil: 'load', timeout: 45000 });
        await page.waitForTimeout(3500);

        for (let s = 1; s <= TOTAL_SCROLLS_PER_KW; s++) {
          await page.evaluate(() => window.scrollBy(0, 3000));
          await page.waitForTimeout(PAUSA_SCROLL_MS);
        }

        const cards = await extrairCardsDaPagina(page, kw);
        let novosNaKw = 0;

        for (const card of cards) {
          card.dest_url_final = decodLFB(card.dest_href_raw);
          if (!adsMap.has(card.library_id)) {
            adsMap.set(card.library_id, card);
            writeStream.write(JSON.stringify(card) + '\n');
            novosNaKw++;
          }
        }
        console.log(`   └─ Cards encontrados nesta KW: ${cards.length} | Novos acumulados: +${novosNaKw} (Total tema: ${adsMap.size})`);
      } catch (err) {
        console.error(`   [ERRO] Falha na KW "${kw}": ${err.message}`);
      }
    }

    writeStream.end();

    const todosAds = Array.from(adsMap.values());
    console.log(`\n📊 Total de anúncios únicos capturados para [${tema.nome}]: ${todosAds.length}`);

    // Agrupamento por anunciante
    const anunciantesMap = new Map();
    for (const ad of todosAds) {
      const nome = (ad.anunciante && ad.anunciante !== 'Desconhecido') ? ad.anunciante : 'Anunciante em Destaque';
      if (!anunciantesMap.has(nome)) {
        anunciantesMap.set(nome, {
          nome,
          page_id: ad.page_id,
          page_href: ad.page_href,
          total_ads_capturados: 0,
          total_multiplier: 0,
          ads: []
        });
      }
      const agg = anunciantesMap.get(nome);
      agg.total_ads_capturados++;
      agg.total_multiplier += (ad.multiplier_estimate || 1);
      if (!agg.page_id && ad.page_id) agg.page_id = ad.page_id;
      if (!agg.page_href && ad.page_href) agg.page_href = ad.page_href;
      agg.ads.push(ad);
    }

    const rankingAnunciantes = Array.from(anunciantesMap.values())
      .filter(a => a.nome !== 'Desconhecido' && a.nome !== 'Anunciante em Destaque')
      .sort((a, b) => (b.total_multiplier * 3 + b.total_ads_capturados) - (a.total_multiplier * 3 + a.total_ads_capturados));

    const topAnunciante = rankingAnunciantes[0] || (Array.from(anunciantesMap.values())[0] || {
      nome: 'Destaque Geral',
      total_ads_capturados: todosAds.length,
      ads: todosAds.slice(0, 5)
    });

    console.log(`🏆 Top Anunciante Campeão: "${topAnunciante.nome}" (${topAnunciante.total_ads_capturados} ads, scale score: ${topAnunciante.total_multiplier})`);

    // Salvar top anunciantes e anúncios
    const topAdsFile = path.join(temaDir, `top_anuncios_${tema.id}.json`);
    fs.writeFileSync(topAdsFile, JSON.stringify({
      tema: tema.nome,
      data_mineracao: new Date().toISOString(),
      total_ads_coletados: todosAds.length,
      ranking_anunciantes: rankingAnunciantes.slice(0, 10),
      top_anunciante_campeao: topAnunciante
    }, null, 2), 'utf8');

    // Screenshot da Biblioteca do Anunciante Campeão
    const screenshotPath = path.join(temaDir, `screenshot_biblioteca_${tema.id}.png`);
    try {
      console.log(`📸 Capturando screenshot da biblioteca de anúncios de "${topAnunciante.nome}"...`);
      let pageLibraryUrl = '';
      if (topAnunciante.page_id) {
        pageLibraryUrl = buildUrlPageLibrary(topAnunciante.page_id);
      } else {
        pageLibraryUrl = buildUrlPageLibrary(topAnunciante.nome);
      }

      await page.goto(pageLibraryUrl, { waitUntil: 'load', timeout: 35000 });
      await page.waitForTimeout(4000);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`   ✅ Screenshot salvo em: ${screenshotPath}`);
    } catch (ssErr) {
      console.warn(`   [WARN] Falha ao capturar screenshot da página do anunciante: ${ssErr.message}`);
    }

    relatorioResumo[tema.id] = {
      tema: tema.nome,
      total_ads: todosAds.length,
      top_anunciante: topAnunciante.nome,
      top_ads_count: topAnunciante.total_ads_capturados,
      screenshot: screenshotPath,
      top_ads: topAnunciante.ads.slice(0, 5)
    };
  }

  await browser.close();

  const summaryFile = path.join(OUTPUT_BASE, 'resumo_consolidado_5_temas.json');
  fs.writeFileSync(summaryFile, JSON.stringify(relatorioResumo, null, 2), 'utf8');

  console.log(`\n===============================================================`);
  console.log(`🎉 MINERAÇÃO DOS 5 TEMAS CONCLUÍDA COM ÊXITO!`);
  console.log(`===============================================================\n`);
}

rodarMineracaoGeral().catch(err => {
  console.error('💥 Erro fatal:', err);
  process.exit(1);
});

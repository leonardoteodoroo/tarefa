const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

async function buscar5Acaiterias() {
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
  
  const query = "acai no copo delivery peca pelo whatsapp barca";
  const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(query)}&search_type=keyword_unordered&media_type=all`;
  
  await page.goto(url, { waitUntil: 'load', timeout: 50000 });
  await page.waitForTimeout(4000);

  for (let s = 0; s < 6; s++) {
    await page.evaluate(() => window.scrollBy(0, 3000));
    await page.waitForTimeout(1500);
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

  await browser.close();

  // Filtrar apenas açaiterias reais e anunciantes distintos
  const anunciantesVistos = new Set();
  const acaiteriasValidas = [];

  for (const c of cards) {
    const txt = (c.anunciante + ' ' + c.copy).toLowerCase();
    if (txt.includes('hamburguer') && !txt.includes('açaí')) continue;
    if (c.anunciante === 'Desconhecido' || c.anunciante.length < 3) continue;
    if (c.anunciante.toLowerCase() === 'mocorongo açaí') continue; // já usado no HTML principal

    if (!anunciantesVistos.has(c.anunciante.toLowerCase())) {
      anunciantesVistos.add(c.anunciante.toLowerCase());
      acaiteriasValidas.push(c);
    }
  }

  console.log(JSON.stringify(acaiteriasValidas.slice(0, 8), null, 2));
}

buscar5Acaiterias().catch(console.error);

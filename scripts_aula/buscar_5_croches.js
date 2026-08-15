const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

async function buscar5Croches() {
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
  const queries = [
    "amigurumi personalizado sob encomenda",
    "bolsa de croche artesanal pronta entrega",
    "porta maternidade croche feito a mao",
    "tapete de croche pronta entrega"
  ];

  const porLibId = new Map();

  for (const query of queries) {
    const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(query)}&search_type=keyword_unordered&media_type=all`;
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 45000 });
      await page.waitForTimeout(3000);

      for (let s = 0; s < 4; s++) {
        await page.evaluate(() => window.scrollBy(0, 3000));
        await page.waitForTimeout(1200);
      }

      const cards = await page.evaluate(() => {
        const allDivs = Array.from(document.querySelectorAll('div'));
        const candidateDivs = allDivs.filter(d => {
          const t = d.innerText || '';
          return (t.includes('Library ID:') || t.includes('ID da biblioteca:'));
        });

        const list = [];
        for (const div of candidateDivs) {
          const texto = div.innerText || '';
          const libMatch = texto.match(/(?:Library ID|ID da biblioteca)\s*[:#]?\s*(\d+)/i);
          if (!libMatch) continue;
          const libId = libMatch[1];

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

          list.push({ libId, anunciante, copy, dataInicio, textoLen: texto.length });
        }
        return list;
      });

      for (const c of cards) {
        if (!porLibId.has(c.libId) || porLibId.get(c.libId).textoLen < c.textoLen) {
          porLibId.set(c.libId, c);
        }
      }
    } catch (err) {
      console.error(`Erro na query ${query}:`, err.message);
    }
  }

  await browser.close();

  // Filtrar apenas peças físicas de crochê (remover cursos, apostilas, PDFs, gráficos)
  const anunciantesVistos = new Set();
  const crochesValidos = [];

  for (const [libId, c] of porLibId.entries()) {
    const txt = (c.anunciante + ' ' + c.copy).toLowerCase();
    if (txt.includes('curso') || txt.includes('apostila') || txt.includes('vídeo aula') || txt.includes('videoaula') || txt.includes('passo a passo para aprender') || txt.includes('aprenda a fazer') || txt.includes('método')) continue;
    if (c.anunciante === 'Desconhecido' || c.anunciante.length < 3) continue;
    if (c.anunciante.toLowerCase().includes('dona.ana')) continue;

    if (!anunciantesVistos.has(c.anunciante.toLowerCase())) {
      anunciantesVistos.add(c.anunciante.toLowerCase());
      crochesValidos.push(c);
    }
  }

  console.log(JSON.stringify(crochesValidos.slice(0, 10), null, 2));
}

buscar5Croches().catch(console.error);

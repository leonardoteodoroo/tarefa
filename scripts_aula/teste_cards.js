const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: 'pt-BR',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  const url = 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=salao%20de%20beleza&search_type=keyword_unordered&media_type=all';
  
  console.log('Navegando para:', url);
  await page.goto(url, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(4000);
  
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, 3000));
    await page.waitForTimeout(1500);
  }

  const data = await page.evaluate(() => {
    const allDivs = Array.from(document.querySelectorAll('div'));
    const matchingDivs = allDivs.filter(d => {
      const t = d.innerText || '';
      return (t.includes('Library ID') || t.includes('ID da biblioteca')) && (t.match(/Library ID|ID da biblioteca/gi) || []).length <= 2;
    });

    return matchingDivs.slice(0, 5).map(d => ({
      text: d.innerText,
      anchors: Array.from(d.querySelectorAll('a')).map(a => ({ href: a.href, text: a.innerText }))
    }));
  });

  console.log(`Encontrados ${data.length} blocos com Library ID:`);
  for (let i = 0; i < data.length; i++) {
    console.log(`\n--- BLOCO ${i + 1} ---`);
    console.log('TEXTO:\n', data[i].text);
    console.log('LINKS:\n', data[i].anchors);
  }

  await browser.close();
})();

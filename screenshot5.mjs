import puppeteer from "puppeteer";
const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});

const shots = [
  ["duvidas-topo", "/duvidas", 1280, 900, false],
  ["duvidas-full", "/duvidas", 1280, 900, true],
  ["duvidas-mobile", "/duvidas", 390, 844, true],
];

for (const [name, path, w, h, full] of shots) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h });
  await page
    .goto("http://localhost:4173" + path, { waitUntil: "networkidle0" })
    .catch(() => {});
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: `/tmp/${name}.png`, fullPage: full });
  console.log("✓", name);
  await page.close();
}
await browser.close();

const urls = [
  'https://portal.codeemanipal.in',
  'https://code-e-manipal-portal.vercel.app',
];

async function check() {
  for (const u of urls) {
    console.log(`Checking ${u}...`);
    try {
      const res = await fetch(`${u}/api/event-config`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        redirect: 'manual'
      });
      console.log(`  Status: ${res.status} ${res.statusText}`);
      const text = await res.text();
      console.log(`  Body: ${text.slice(0, 300)}`);
    } catch (e) {
      console.log(`  Failed: ${e.message}`, e.cause);
    }
  }
}

check();

const prodUrl = 'https://code-e-manipal-portal.vercel.app';

async function testProd() {
  console.log('Querying production deployment:', prodUrl);

  const endpoints = [
    '/',
    '/problem-statements',
    '/judge',
    '/api/problem-statements',
    '/api/event-config',
    '/api/auth/me',
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${prodUrl}${ep}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        redirect: 'manual',
      });
      console.log(`Endpoint: ${ep} -> Status: ${res.status} ${res.statusText}`);
      const contentType = res.headers.get('content-type');
      if (res.headers.get('location')) {
        console.log(`   Location: ${res.headers.get('location')}`);
      }
      if (contentType && contentType.includes('application/json')) {
        const json = await res.json();
        console.log(`   Response JSON:`, JSON.stringify(json));
      } else {
        const text = await res.text();
        console.log(`   Response snippet:`, text.slice(0, 300).replace(/\s+/g, ' '));
      }
    } catch (err) {
      console.error(`Endpoint ${ep} failed:`, err.message);
    }
    console.log('----------------------------------------------------');
  }
}

testProd().catch(console.error);

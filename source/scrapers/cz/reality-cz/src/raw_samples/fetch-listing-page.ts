import { RealityAuth } from '../utils/realityAuth';

async function main() {
  const auth = new RealityAuth();
  const data = await auth.request('https://api.reality.cz/prodej/byty/Praha/?skip=0&take=5');
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);

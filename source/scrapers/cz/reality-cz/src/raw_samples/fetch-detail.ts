import { RealityAuth } from '../utils/realityAuth';

async function main() {
  const id = process.argv[2] || '1234567';
  const auth = new RealityAuth();
  const data = await auth.request(`https://api.reality.cz/${id}/`);
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);

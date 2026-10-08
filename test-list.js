import { config } from 'dotenv';
config();

async function run() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY.trim()}`;
  const res = await fetch(url);
  const data = await res.json();
  console.log(data.models?.map(m => m.name).join('\n') || data);
}
run();

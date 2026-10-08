import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';
config();

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim());

async function run() {
  try {
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const res = await model.generateContent('hi');
    console.log(res.response.text());
  } catch(e) {
    console.log(e.message);
  }
}
run();

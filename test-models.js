import { GoogleGenAI } from '@google/genai';
import { config } from 'dotenv';
config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const res = await ai.models.generateContent({ model: 'gemini-1.5-pro', contents: 'hi' });
    console.log(res.text);
  } catch(e) {
    console.log(e.message);
  }
}
run();

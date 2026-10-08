import { GoogleGenAI } from '@google/genai';

export async function askAgent(db, userQuery, apiKey) {
  if (!apiKey) {
    return "Error: GEMINI_API_KEY is not set in your .env file. Please add it to use the CEREBRO Digital Clone AI.";
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const schema = `
CREATE TABLE activity_events (
  id INTEGER PRIMARY KEY,
  occurred_at TEXT, -- format 'YYYY-MM-DD HH:MM:SS'
  event_type TEXT, -- window_focus, input_batch, screenshot, file_modified, network_activity, etc.
  app_name TEXT, -- e.g. 'Code.exe', 'chrome.exe'
  window_title TEXT, -- e.g. 'index.js - project - Visual Studio Code'
  data TEXT -- JSON string
);
CREATE TABLE window_sessions (
  id INTEGER PRIMARY KEY,
  started_at TEXT,
  ended_at TEXT,
  duration_ms INTEGER,
  app_name TEXT,
  window_title TEXT
);
`;

  const prompt1 = `You are a data assistant for CEREBRO Digital Clone. You have access to a local SQLite database tracking the user's computer activity.
Schema:
${schema}

User question: "${userQuery}"

Write ONLY a raw SQLite SELECT query to fetch the necessary data to answer this question. Do not include markdown formatting, backticks, or explanations. If you need today's date, use date('now', 'localtime'). Limit the query to 50 rows.`;

  const modelsToTry = ['gemini-3.1-pro-preview', 'gemini-1.5-pro-latest', 'gemini-1.5-flash-latest', 'gemini-pro'];
  
  async function safeGenerate(promptText) {
    for (const model of modelsToTry) {
      try {
        const res = await ai.models.generateContent({ model, contents: promptText });
        return res.text;
      } catch (e) {
        // Log locally, but continue trying next model
        console.error(`Model ${model} failed:`, e.message);
      }
    }
    throw new Error('All available models failed or rejected the request (Check quota or API key).');
  }

  let sql;
  try {
    const rawSql = await safeGenerate(prompt1);
    sql = rawSql.replace(/```sql|```/gi, '').trim();
  } catch(e) {
    return 'Error generating query: ' + e.message;
  }

  let dbResult;
  try {
    if (!sql.toUpperCase().startsWith('SELECT')) return "Refusing to run non-SELECT query: " + sql;
    const [rows] = await db.query(sql);
    dbResult = JSON.stringify(rows).substring(0, 10000); 
  } catch (e) {
    dbResult = "Error executing query: " + e.message;
  }
  
  const prompt2 = `You are CEREBRO, the user's minimalist and stylish digital clone assistant.
User question: "${userQuery}"

SQL Query executed: ${sql}
Query Result: ${dbResult}

Provide a helpful, friendly, and concise answer to the user based on the database results. Speak as CEREBRO. Keep the answer stylish and clear.`;

  try {
    const finalRes = await safeGenerate(prompt2);
    return finalRes;
  } catch (e) {
    return "Error generating answer: " + e.message;
  }
}

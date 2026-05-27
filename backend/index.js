// 1. Carrega as variáveis de ambiente do arquivo .env local
require('dotenv').config();
require('dotenv').config({ path: '../.env' });

const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');

const app = express();
app.use(cors());
app.use(express.json());

// 2. Busca as chaves aceitando o formato padrão ou com o prefixo EXPO_PUBLIC_
const groqKey = process.env.GROQ_API_KEY || process.env.EXPO_PUBLIC_GROQ_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY;

// Log de segurança no console do Render para validação
if (!groqKey) console.warn("AVISO: GROQ_API_KEY não foi detectada de nenhuma forma!");
if (!geminiKey) console.warn("AVISO: GEMINI_API_KEY não foi detectada de nenhuma forma!");

// Configuração das IAs (Injeta string provisória para o servidor não falhar no boot)
const genAI = new GoogleGenerativeAI(geminiKey || "CHAVE_PROVISORIA");
const groq = new Groq({ apiKey: groqKey || "CHAVE_PROVISORIA" });

// Rota para Gemini
app.post('/api/gemini', async (req, res) => {
  try {
    if (!geminiKey) throw new Error("A chave GEMINI_API_KEY não está configurada no servidor.");
    
    const { prompt, systemInstruction } = req.body;
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: systemInstruction
    });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ text: response.text() });
  } catch (error) {
    console.error('Erro Gemini:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para Groq
app.post('/api/groq', async (req, res) => {
  try {
    if (!groqKey) throw new Error("A chave GROQ_API_KEY não está configurada no servidor.");

    const { messages, model } = req.body;
    const chatCompletion = await groq.chat.completions.create({
      messages,
      model: model || "llama-3.3-70b-versatile",
    });
    let raw = chatCompletion.choices[0].message.content || '';
    // Remove markdown code fences: ```json ... ``` ou ``` ... ```
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    // Remove prefixos como "PERGUNTA: " ou "CHUTE: " antes do JSON
    raw = raw.replace(/^(PERGUNTA|CHUTE):\s*/i, '');
    res.json({ text: raw.trim() });
  } catch (error) {
    console.error('Erro Groq:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health Check
app.get('/health', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando perfeitamente na porta ${PORT}`);
  if (groqKey && geminiKey) {
    console.log("Todas as chaves de API foram carregadas com sucesso! 🚀");
  }
});
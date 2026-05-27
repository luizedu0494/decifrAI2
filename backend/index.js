const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');

const app = express();
app.use(cors());
app.use(express.json());

// Configuração das IAs
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Rota para Gemini
app.post('/api/gemini', async (req, res) => {
  try {
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
    const { messages, model } = req.body;
    const chatCompletion = await groq.chat.completions.create({
      messages,
      model: model || "llama-3.3-70b-versatile",
    });
    res.json({ text: chatCompletion.choices[0].message.content });
  } catch (error) {
    console.error('Erro Groq:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health Check
app.get('/health', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Middleware to prevent caching of HTML and Service Worker so updates are immediate
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html') || req.path === '/sw.js') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Copilot AI Chat Endpoint (Etapa 9)
app.post('/api/copilot/chat', async (req, res) => {
  try {
    const { message, history = [], contextData = {} } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Mensagem é obrigatória' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ 
        error: 'Copiloto indisponível', 
        message: 'A chave de API do Gemini (GEMINI_API_KEY) não está configurada no servidor. O restante do PAPER MAX continua operando normalmente.' 
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const systemInstruction = `
Você é o Copiloto Inteligente oficial do PAPER MAX, o sistema operacional de uma papelaria artesanal e personalizada.
Seu objetivo é ajudar o gestor/operador explicando situações reais, respondendo perguntas operacionais e sugerindo ações com base estritamente nos DADOS REAIS fornecidos abaixo.

REGRAS ESTRITAS:
1. NUNCA invente dados, valores, números de pedidos ou status. Se a informação não estiver nos dados fornecidos, informe educadamente que não possui esse dado.
2. Separe claramente suas respostas em:
   - 📌 DADO: Fatos extraídos diretamente do sistema.
   - 🔍 ANÁLISE: Interpretação lógica feita a partir dos dados.
   - 💡 SUGESTÃO: Ações práticas recomendadas (nunca execute ações críticas automaticamente).
3. Mantenha tom profissional, claro, objetivo e em português do Brasil.
4. Respeite os termos oficiais da produção (aprovado, aguardando impressão, impressão, corte, vinco, montagem, acabamento, conferência, embalagem, pronto, bloqueado).
5. Contexto atual do PAPER MAX (obtido em tempo real):
${JSON.stringify(contextData, null, 2)}
    `.trim();

    const contents = [];
    if (Array.isArray(history)) {
      for (const h of history) {
        contents.push({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }]
        });
      }
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction,
        temperature: 0.2,
      }
    });

    res.json({ reply: response.text || 'Sem resposta gerada.' });
  } catch (err) {
    console.error('[Copilot API Error]:', err);
    res.status(500).json({ 
      error: 'Erro no Copiloto', 
      message: 'O Copiloto encontrou um erro ao processar sua solicitação. O sistema operacional PAPER MAX continua funcionando normalmente.' 
    });
  }
});

// Serve static assets from root directory
app.use(express.static(__dirname));

// Fallback to index.html
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

export default app;

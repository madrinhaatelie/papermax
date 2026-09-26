import React, { useState } from 'react';
import { Sparkles, Send, Bot, User, Lightbulb } from 'lucide-react';
import { CopilotMessage, AtelierSettings, Order, Product } from '../../types';
import { askGeminiCopilot } from '../../services/geminiService';

interface CopilotViewProps {
  settings: AtelierSettings;
  orders: Order[];
  products: Product[];
}

export const CopilotView: React.FC<CopilotViewProps> = ({ settings, orders, products }) => {
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'msg_init',
      role: 'assistant',
      content: `Olá! Sou o **Copiloto Criativo do PAPER MAX** ✨
Estou aqui para auxiliar na criatividade, redação e precificação do seu ateliê. 

Como posso te ajudar hoje?
- 🎨 **Sugerir paletas de papéis & cores** para temas de festas
- ✍️ **Escrever legendas atrativas** para posts no Instagram ou catálogos
- 💰 **Consultar orientações de precificação** e markup para papelaria personalizada
- 💬 **Criar mensagens para WhatsApp** (aprovação de arte, aviso de envio, orçamentos)`,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      suggestions: [
        'Sugerir paleta de papéis para tema Bosque Encantado',
        'Legenda de Instagram para lançamento de topo de bolo',
        'Mensagem de WhatsApp para confirmação de pagamento de sinal',
        'Como calcular markup para caixas personalizadas'
      ]
    }
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || inputPrompt;
    if (!query.trim() || isLoading) return;

    const userMsg: CopilotMessage = {
      id: 'user_' + Date.now(),
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputPrompt('');
    setIsLoading(true);

    const contextData = {
      atelierName: settings.name,
      totalOrders: orders.length,
      totalCatalogProducts: products.length,
      hourlyRate: settings.hourlyLaborRate
    };

    const aiResponse = await askGeminiCopilot(query, contextData);

    const assistantMsg: CopilotMessage = {
      id: 'ai_' + Date.now(),
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, assistantMsg]);
    setIsLoading(false);
  };

  return (
    <div className="h-[calc(100vh-6.5rem)] flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
      {/* Copilot Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              Copiloto do Ateliê
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                Gemini
              </span>
            </h2>
            <p className="text-xs text-slate-500">Ideias de temas, combinações de papéis, legendas e atendimento.</p>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-5 overflow-y-auto space-y-4 custom-scroll bg-slate-50/30">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5 shadow-xs">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-2xl rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white font-medium rounded-tr-none shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none space-y-3 shadow-xs'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" /> Sugestões rápidas:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.suggestions.map((sugg, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(sugg)}
                        className="text-[11px] bg-slate-50 hover:bg-slate-100 text-indigo-700 hover:text-indigo-900 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors text-left cursor-pointer"
                      >
                        {sugg} &rarr;
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className={`text-[10px] ${msg.role === 'user' ? 'text-indigo-100 text-right' : 'text-slate-400'}`}>
                {msg.timestamp}
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-lg bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 shrink-0 mt-0.5 shadow-xs">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 text-xs text-slate-500 flex items-center gap-2 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.2s]" />
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.4s]" />
              <span>Gerando resposta personalizada...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="p-4 bg-white border-t border-slate-200">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Pergunte sobre temas de festa, paletas de papel, legendas ou dúvidas de precificação..."
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            disabled={isLoading}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
          />
          <button
            type="submit"
            disabled={isLoading || !inputPrompt.trim()}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

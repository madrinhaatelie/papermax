import { GoogleGenAI } from '@google/genai';

export async function askGeminiCopilot(prompt: string, contextData?: Record<string, any>): Promise<string> {
  try {
    const apiKey = process.env.GEMINI_API_KEY || (window as any).__GEMINI_KEY__ || '';
    if (!apiKey) {
      return fallbackCopilotResponse(prompt);
    }

    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = `
Você é o Copiloto Especialista do PAPER MAX (Sistema de Gestão para Papelaria Personalizada, Cartonagem e Gráficas Rápidas).
Seu objetivo é ajudar artesãos, designers de papelaria e donos de ateliês a:
1. Criar temas encantadores para festas infantis, casamentos, 15 anos e datas comemorativas com paletas de cores específicas (Color Plus, Glitter, Lamicote).
2. Redigir copies irresistíveis para redes sociais (Instagram, WhatsApp, Elo7, Shopee).
3. Auxiliar no cálculo de precificação, markup, tempo de corte em plotter (Silhouette/Cricut/Foison) e montagem manual.
4. Redigir mensagens amigáveis e profissionais para clientes (solicitação de aprovação de arte, prazos de pagamento, regras de alteração).

Responda sempre em Português do Brasil com tom simpático, criativo, prático e profissional, usando formatação limpa com marcadores e emojis moderados.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: `Contexto do Ateliê: ${JSON.stringify(contextData || {})}\n\nPergunta do Ateliê: ${prompt}` }
          ]
        }
      ],
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    return response.text || 'Não foi possível gerar uma resposta no momento.';
  } catch (err: any) {
    console.warn('Gemini API call returned error or key missing, fallbacking gracefully:', err);
    return fallbackCopilotResponse(prompt);
  }
}

function fallbackCopilotResponse(prompt: string): string {
  const p = prompt.toLowerCase();

  if (p.includes('tema') || p.includes('paleta') || p.includes('festa') || p.includes('aniversário')) {
    return `✨ **Sugestão Criativa de Tema & Paleta de Papéis:**

1. **Jardim das Fadas & Borboletas 3D Encantadas**
   - **Paleta de Papéis:** Rosa Bebê (Color Plus Verona), Verde Menta (Color Plus Rio de Janeiro), Lamicote Dourado 250g e Papel Glitter Pérola.
   - **Acabamentos Recomendados:** Visor Shaker com micro pérolas e estrelinhas holográficas, laço de cetim duplo nº 3 com ponto de luz/chaton.
   - **Destaque:** Caixas Milk e Pirâmide com asas recortadas na plotter em relevo 3D.

2. **Safári Boho Chic Aquarelado**
   - **Paleta de Papéis:** Kraft 200g, Bege Claro (Color Plus Marfim), Verde Oliva (Color Plus Porto Seguro) e Lamicote Cobre/Rose Gold.
   - **Acabamentos:** Folhagens em camadas sobrepostas com fita banana, cordão de algodão cru ou rami rústico.

💡 *Dica do Ateliê:* Ofereça sempre um kit de topos de bolo combinando com as caixas para aumentar o ticket médio!`;
  }

  if (p.includes('preço') || p.includes('precific') || p.includes('custo') || p.includes('lucro')) {
    return `📊 **Fórmula de Precificação Recomendada para Papelaria Criativa:**

\`Preço de Venda = (Custo dos Insumos + Custo de Máquina/Depreciação + Mão de Obra) × Multiplicador de Markup (2.5 a 3.0)\`

**Exemplo Prático (Caixa Luxo):**
- Insumos (Folha Offset + Lamicote + Fita Cetim + Chaton + Fita Banana): **R$ 3,40**
- Desgaste Plotter & Impressora por folha: **R$ 0,50**
- Tempo de Montagem (15 min a R$ 35/hora mão de obra): **R$ 8,75**
- **Custo Base Total:** R$ 12,65
- **Preço Sugerido (Markup 2.5x):** R$ 31,60 por unidade (ou R$ 14,50/un em lotes de 10 unidades pelo ganho de escala no corte em lote).

💡 *Dica:* Nunca cobre menos do que o dobro do custo de material para cobrir margem de erro, perdas de papel e impostos.`;
  }

  if (p.includes('whatsapp') || p.includes('mensagem') || p.includes('aprova') || p.includes('cliente')) {
    return `💬 **Modelo de Mensagem para Aprovação de Arte (WhatsApp):**

"Olá, *[Nome da Cliente]*! Tudo bem? 🥰

A arte do seu pedido *[Nº do Pedido - Tema]* ficou pronta e linda! ✨
Preparamos a prévia digital para você conferir cada detalhe:

🔗 *Link de Aprovação:* [Link da Arte]

⚠️ **Atenção aos detalhes importantes:**
1. Verifique a grafia do nome e a idade.
2. Lembre-se que as cores impressas podem ter uma leve variação em relação à tela do celular.
3. Pedimos a validação em até 48h para não comprometer o prazo de produção e envio.

Se estiver tudo certinho, basta clicar em 'Aprovar Arte' ou nos avisar por aqui! Qualquer alteração, estamos à disposição."`;
  }

  return `✨ **Assistente PAPER MAX**:
Entendi sua solicitação! Como especialista em papelaria artesanal e personalizada, posso te ajudar a:
- Criar paletas de cores e combinações de papéis (Color Plus, Fotográfico, Lamicote).
- Calcular custos de insumos, horas de produção e sugerir preços de venda com lucro real.
- Criar legendas atrativas para Instagram e mensagens de pós-venda para clientes.

Como posso te apoiar agora no seu ateliê?`;
}

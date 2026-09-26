import React, { useState } from 'react';
import { CheckCircle, AlertCircle, MessageCircle, Image as ImageIcon } from 'lucide-react';
import { Order, AtelierSettings } from '../../types';
import confetti from 'canvas-confetti';

interface OrderApprovalViewProps {
  order: Order;
  settings: AtelierSettings;
  onUpdateOrder: (updatedOrder: Order) => void;
  onClose: () => void;
}

export const OrderApprovalView: React.FC<OrderApprovalViewProps> = ({
  order,
  settings,
  onUpdateOrder,
  onClose
}) => {
  const [artUrl, setArtUrl] = useState(order.artRevisions[0]?.imageUrl || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop&q=80');
  const [feedback, setFeedback] = useState('');
  const [isApproved, setIsApproved] = useState(order.currentArtStatus === 'approved');

  const handleApprove = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    const updated: Order = {
      ...order,
      status: 'art_approved',
      currentArtStatus: 'approved',
      artRevisions: [
        ...order.artRevisions,
        {
          id: 'rev_' + Date.now(),
          date: new Date().toISOString(),
          version: (order.artRevisions.length || 0) + 1,
          imageUrl: artUrl,
          feedback: feedback || 'Arte aprovada pelo cliente com sucesso!',
          approved: true,
          status: 'approved'
        }
      ],
      updatedAt: new Date().toISOString()
    };

    setIsApproved(true);
    onUpdateOrder(updated);
  };

  const handleRequestChanges = () => {
    if (!feedback) {
      alert('Por favor, descreva as alterações solicitadas para a arte.');
      return;
    }

    const updated: Order = {
      ...order,
      status: 'art_creation',
      currentArtStatus: 'changes_requested',
      artRevisions: [
        ...order.artRevisions,
        {
          id: 'rev_' + Date.now(),
          date: new Date().toISOString(),
          version: (order.artRevisions.length || 0) + 1,
          imageUrl: artUrl,
          feedback,
          approved: false,
          status: 'rejected'
        }
      ],
      updatedAt: new Date().toISOString()
    };

    onUpdateOrder(updated);
    alert('Alterações registradas! O status do pedido voltou para Criação de Arte.');
  };

  const openWhatsApp = () => {
    const text = encodeURIComponent(
      `Olá ${order.customerName}! Aqui é do ${settings.name}. A arte do seu pedido *${order.orderNumber}* já está disponível para conferência! Por favor, valide os nomes, idades e cores.`
    );
    const cleanPhone = order.customerWhatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/55${cleanPhone}?text=${text}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
              Conferência de Arte
            </span>
            <span className="text-xs text-slate-500">Pedido {order.orderNumber}</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-1">
            {order.customerName} • {order.items[0]?.theme || 'Personalizado'}
          </h2>
        </div>

        <button
          onClick={openWhatsApp}
          className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <MessageCircle className="w-4 h-4" />
          Enviar no WhatsApp
        </button>
      </div>

      {/* Art Preview & Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Visual Mockup Container */}
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-3">
          <div className="aspect-square rounded-lg bg-white overflow-hidden relative group border border-slate-200 flex items-center justify-center">
            {artUrl ? (
              <img 
                src={artUrl} 
                alt="Prévia da Arte" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center text-slate-400 text-xs">
                <ImageIcon className="w-8 h-8 mb-2" />
                <span>Nenhuma imagem de arte carregada</span>
              </div>
            )}
            
            {isApproved && (
              <div className="absolute top-3 right-3 bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" /> Aprovado
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              URL da Imagem / Mockup da Arte
            </label>
            <input
              type="text"
              value={artUrl}
              onChange={(e) => setArtUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-base sm:text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Requirements & Action Box */}
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Checklist de Conferência
            </h4>
            <ul className="text-xs text-slate-600 space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <strong>Itens:</strong> {order.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <strong>Texto / Idade:</strong> {order.items[0]?.customizationText || 'Não especificado'}
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <strong>Tema & Cores:</strong> {order.items[0]?.theme || 'Geral'}
              </li>
            </ul>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observações / Ajustes Solicitados
            </label>
            <textarea
              rows={3}
              placeholder="Ex: Mudar a cor do laço para lilás, corrigir a grafia para 'Guilherme'."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-base sm:text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              onClick={handleRequestChanges}
              className="w-full sm:w-1/2 min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              <AlertCircle className="w-4 h-4" />
              Solicitar Ajustes
            </button>

            <button
              onClick={handleApprove}
              className="w-full sm:w-1/2 min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              Aprovar Arte
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-3 border-t border-slate-200">
        <button
          onClick={onClose}
          className="w-full sm:w-auto min-h-[44px] sm:min-h-auto flex items-center justify-center px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
        >
          Fechar Visualizador
        </button>
      </div>
    </div>
  );
};

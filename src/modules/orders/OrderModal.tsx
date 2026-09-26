import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ShoppingBag } from 'lucide-react';
import { Order, OrderItem, Product, OrderStatus, PaymentStatus, PaymentMethod } from '../../types';
import { Modal } from '../../components/Modal';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (order: Order) => void;
  orderToEdit?: Order | null;
  products: Product[];
}

export const OrderModal: React.FC<OrderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  orderToEdit,
  products
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerWhatsapp, setCustomerWhatsapp] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [deliveryDeadline, setDeliveryDeadline] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery' | 'correios' | 'motoboy' | 'transportadora'>('pickup');
  const [shippingCost, setShippingCost] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<OrderStatus>('pending_payment');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('unpaid');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [amountPaid, setAmountPaid] = useState(0);
  const [items, setItems] = useState<OrderItem[]>([]);

  // Item form inside modal
  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemTheme, setItemTheme] = useState('');
  const [itemCustomText, setItemCustomText] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [itemPrice, setItemPrice] = useState(0);
  const [itemFinishings, setItemFinishings] = useState('');

  useEffect(() => {
    if (orderToEdit) {
      setCustomerName(orderToEdit.customerName);
      setCustomerWhatsapp(orderToEdit.customerWhatsapp);
      setCustomerEmail(orderToEdit.customerEmail || '');
      setEventDate(orderToEdit.eventDate || '');
      setDeliveryDeadline(orderToEdit.deliveryDeadline.split('T')[0]);
      setDeliveryMethod(orderToEdit.deliveryMethod);
      setShippingCost(orderToEdit.shippingCost);
      setDiscount(orderToEdit.discount);
      setNotes(orderToEdit.notes || '');
      setStatus(orderToEdit.status);
      setPaymentStatus(orderToEdit.paymentStatus);
      setPaymentMethod(orderToEdit.paymentMethod);
      setAmountPaid(orderToEdit.amountPaid);
      setItems(orderToEdit.items || []);
    } else {
      // Defaults for new order
      setCustomerName('');
      setCustomerWhatsapp('');
      setCustomerEmail('');
      setEventDate('');
      
      const defaultDeadline = new Date();
      defaultDeadline.setDate(defaultDeadline.getDate() + 7);
      setDeliveryDeadline(defaultDeadline.toISOString().split('T')[0]);
      
      setDeliveryMethod('pickup');
      setShippingCost(0);
      setDiscount(0);
      setNotes('');
      setStatus('pending_payment');
      setPaymentStatus('unpaid');
      setPaymentMethod('pix');
      setAmountPaid(0);
      setItems([]);
    }
  }, [orderToEdit, isOpen]);

  const handleProductSelect = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = products.find(p => p.id === prodId);
    if (prod) {
      setItemPrice(prod.basePrice);
      setItemQty(prod.minQuantity || 1);
    }
  };

  const handleAddItem = () => {
    const prod = products.find(p => p.id === selectedProductId);
    const productName = prod ? prod.name : 'Item Personalizado';
    
    const newItem: OrderItem = {
      id: 'item_' + Date.now(),
      productId: selectedProductId || 'custom_prod',
      productName,
      theme: itemTheme,
      customizationText: itemCustomText,
      quantity: Math.max(1, Number(itemQty)),
      unitPrice: Math.max(0, Number(itemPrice)),
      totalPrice: Math.max(1, Number(itemQty)) * Math.max(0, Number(itemPrice)),
      finishings: itemFinishings ? itemFinishings.split(',').map(s => s.trim()) : []
    };

    setItems([...items, newItem]);
    // Reset quick item fields
    setSelectedProductId('');
    setItemTheme('');
    setItemCustomText('');
    setItemQty(1);
    setItemPrice(0);
    setItemFinishings('');
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter(i => i.id !== itemId));
  };

  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const totalAmount = Math.max(0, subtotal + Number(shippingCost) - Number(discount));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerWhatsapp) {
      alert('Por favor, informe o nome e o WhatsApp da cliente.');
      return;
    }

    if (items.length === 0) {
      alert('Por favor, adicione pelo menos um produto ao pedido.');
      return;
    }

    const orderNumber = orderToEdit 
      ? orderToEdit.orderNumber 
      : `PED-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    const savedOrder: Order = {
      id: orderToEdit ? orderToEdit.id : 'ord_' + Date.now(),
      orderNumber,
      customerName,
      customerWhatsapp,
      customerEmail,
      eventDate: eventDate || undefined,
      deliveryDeadline: deliveryDeadline || new Date().toISOString(),
      deliveryMethod,
      shippingCost: Number(shippingCost),
      status,
      paymentStatus,
      paymentMethod,
      amountPaid: Number(amountPaid),
      discount: Number(discount),
      subtotal,
      totalAmount,
      notes,
      items,
      artRevisions: orderToEdit ? orderToEdit.artRevisions : [],
      currentArtStatus: orderToEdit ? orderToEdit.currentArtStatus : 'none',
      publicApprovalToken: orderToEdit?.publicApprovalToken || 'art_tok_' + Math.random().toString(36).substring(2, 8),
      createdAt: orderToEdit ? orderToEdit.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSave(savedOrder);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={orderToEdit ? `Editar Pedido ${orderToEdit.orderNumber}` : 'Novo Pedido de Papelaria'}
      subtitle="Cadastre produtos personalizados, tema, dados do evento e condições de pagamento."
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer & Event Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome da Cliente / Contato *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Mariana Silveira"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              WhatsApp *
            </label>
            <input
              type="text"
              required
              placeholder="(11) 98765-4321"
              value={customerWhatsapp}
              onChange={(e) => setCustomerWhatsapp(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              E-mail (Opcional)
            </label>
            <input
              type="email"
              placeholder="cliente@email.com"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Data da Festa / Evento
            </label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-rose-700 mb-1">
              Prazo Limite de Entrega *
            </label>
            <input
              type="date"
              required
              value={deliveryDeadline}
              onChange={(e) => setDeliveryDeadline(e.target.value)}
              className="w-full bg-white border border-rose-200 rounded-lg px-3 py-2 text-base sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500 font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Forma de Envio / Retirada
            </label>
            <select
              value={deliveryMethod}
              onChange={(e: any) => setDeliveryMethod(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
            >
              <option value="pickup">Retirada no Ateliê</option>
              <option value="motoboy">Entrega por Motoboy</option>
              <option value="correios">Correios (Sedex / PAC)</option>
              <option value="transportadora">Transportadora</option>
            </select>
          </div>
        </div>

        {/* Customized Items Section */}
        <div className="bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-indigo-600" />
              Itens & Personalizações do Pedido
            </h4>
          </div>

          {/* Add Item Subform */}
          <div className="p-3 bg-white rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Selecionar Produto</label>
              <select
                value={selectedProductId}
                onChange={(e) => handleProductSelect(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-base sm:text-xs text-slate-800"
              >
                <option value="">-- Personalizado / Novo --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} (R$ {p.basePrice.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tema / Personagem</label>
              <input
                type="text"
                placeholder="Ex: Borboletas 3D"
                value={itemTheme}
                onChange={(e) => setItemTheme(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-base sm:text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nome / Idade / Texto</label>
              <input
                type="text"
                placeholder="Ex: Alice - 2 Anos"
                value={itemCustomText}
                onChange={(e) => setItemCustomText(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-base sm:text-xs text-slate-800"
              />
            </div>

            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Qtd</label>
                <input
                  type="number"
                  min="1"
                  value={itemQty}
                  onChange={(e) => setItemQty(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-base sm:text-xs text-slate-800 text-center"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Unit (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-base sm:text-xs text-slate-800 text-right font-semibold"
                />
              </div>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleAddItem}
                className="w-full flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-auto px-3 rounded-lg text-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </button>
            </div>
          </div>

          {/* Items Table */}
          {items.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold">
                  <tr>
                    <th className="py-2 px-3">Item / Personalização</th>
                    <th className="py-2 px-3">Tema</th>
                    <th className="py-2 px-3 text-center">Qtd</th>
                    <th className="py-2 px-3 text-right">Unitário</th>
                    <th className="py-2 px-3 text-right">Total</th>
                    <th className="py-2 px-3 text-center">Remover</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{item.productName}</div>
                        {item.customizationText && (
                          <div className="text-[11px] text-slate-500">Texto: {item.customizationText}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-indigo-700 font-medium">{item.theme || '-'}</td>
                      <td className="py-2.5 px-3 text-center font-semibold text-slate-800">{item.quantity}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">R$ {item.unitPrice.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">R$ {item.totalPrice.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-rose-500 hover:text-rose-700 p-2 min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Financial & Status Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status do Pedido</label>
              <select
                value={status}
                onChange={(e: any) => setStatus(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-sm text-slate-900"
              >
                <option value="draft">Orçamento</option>
                <option value="pending_payment">Aguardando Pagamento</option>
                <option value="art_creation">Em Criação de Arte</option>
                <option value="art_approval">Aguardando Aprovação da Arte</option>
                <option value="art_approved">Arte Aprovada</option>
                <option value="in_production">Em Produção (Corte/Montagem)</option>
                <option value="ready">Pronto para Entrega</option>
                <option value="delivered">Entregue / Concluído</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Forma de Pagamento</label>
              <select
                value={paymentMethod}
                onChange={(e: any) => setPaymentMethod(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-sm text-slate-900"
              >
                <option value="pix">Pix</option>
                <option value="credit_card">Cartão de Crédito</option>
                <option value="debit_card">Cartão de Débito</option>
                <option value="cash">Dinheiro em Espécie</option>
                <option value="transfer">Transferência Bancária</option>
                <option value="link">Link de Pagamento</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Frete / Entrega (R$)</label>
              <input
                type="number"
                step="0.01"
                value={shippingCost}
                onChange={(e) => setShippingCost(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Desconto (R$)</label>
              <input
                type="number"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-sm text-slate-900"
              />
            </div>
          </div>

          <div className="space-y-3 bg-white p-3 rounded-lg border border-slate-200">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Subtotal:</span>
              <span className="font-semibold text-slate-800">R$ {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-100 pt-2">
              <span>TOTAL DO PEDIDO:</span>
              <span className="text-indigo-700 text-base">R$ {totalAmount.toFixed(2)}</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-emerald-700 mb-1">
                Valor Já Pago / Sinal (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={amountPaid}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setAmountPaid(val);
                  if (val >= totalAmount && totalAmount > 0) {
                    setPaymentStatus('paid');
                  } else if (val > 0) {
                    setPaymentStatus('partial');
                  } else {
                    setPaymentStatus('unpaid');
                  }
                }}
                className="w-full bg-emerald-50/50 border border-emerald-200 rounded-lg px-3 py-2 text-base sm:text-sm text-emerald-800 font-bold"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Observações, Cores e Requisitos Especiais
          </label>
          <textarea
            rows={2}
            placeholder="Ex: Usar lamicote dourado nas caixas, fita rosa bebê, fonte script para o nome Alice."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 sm:py-2 min-h-[44px] sm:min-h-auto text-sm text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 sm:py-2 min-h-[44px] sm:min-h-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Salvar Pedido
          </button>
        </div>
      </form>
    </Modal>
  );
};

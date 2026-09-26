import React, { useState } from 'react';
import { 
  Scissors, 
  Printer, 
  Layers, 
  Clock, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  Sparkles
} from 'lucide-react';
import { ProductionJob, MachineType, Order } from '../../types';
import { Modal } from '../../components/Modal';

interface ProductionViewProps {
  productionJobs: ProductionJob[];
  orders: Order[];
  onSaveJob: (job: ProductionJob) => void;
  onDeleteJob: (id: string) => void;
}

export const ProductionView: React.FC<ProductionViewProps> = ({
  productionJobs,
  orders,
  onSaveJob,
  onDeleteJob
}) => {
  const [machineFilter, setMachineFilter] = useState<string>('all');
  const [isAddJobOpen, setIsAddJobOpen] = useState(false);

  // New job state
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [productName, setProductName] = useState('');
  const [theme, setTheme] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [machine, setMachine] = useState<MachineType>('plotter_corte');
  const [priority, setPriority] = useState<'low' | 'normal' | 'urgent'>('normal');
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [assignedTo, setAssignedTo] = useState('');
  const [deadline, setDeadline] = useState(new Date().toISOString().split('T')[0]);

  const handleAdvanceStep = (job: ProductionJob) => {
    const steps: ProductionJob['step'][] = ['arte', 'impressao', 'corte', 'laminacao', 'montagem', 'embalagem', 'concluido'];
    const currentIndex = steps.indexOf(job.step);
    if (currentIndex < steps.length - 1) {
      const nextStep = steps[currentIndex + 1];
      const updated: ProductionJob = {
        ...job,
        step: nextStep,
        completedAt: nextStep === 'concluido' ? new Date().toISOString() : undefined
      };
      onSaveJob(updated);
    }
  };

  const handleOrderSelect = (orderId: string) => {
    setSelectedOrderId(orderId);
    const ord = orders.find(o => o.id === orderId);
    if (ord && ord.items.length > 0) {
      setProductName(ord.items[0].productName);
      setTheme(ord.items[0].theme || '');
      setQuantity(ord.items[0].quantity);
      setDeadline(ord.deliveryDeadline.split('T')[0]);
    }
  };

  const handleCreateJob = (e: React.FormEvent) => {
    e.preventDefault();
    const ord = orders.find(o => o.id === selectedOrderId);
    const newJob: ProductionJob = {
      id: 'job_' + Date.now(),
      orderId: selectedOrderId || 'custom_ord',
      orderNumber: ord ? ord.orderNumber : 'AVULSO',
      customerName: ord ? ord.customerName : 'Produção Interna',
      productName,
      theme,
      quantity: Number(quantity),
      machine,
      step: 'impressao',
      priority,
      estimatedMinutes: Number(estimatedMinutes),
      assignedTo: assignedTo || 'Equipe de Produção',
      deadline
    };

    onSaveJob(newJob);
    setIsAddJobOpen(false);
  };

  const filteredJobs = productionJobs.filter(j => {
    return machineFilter === 'all' || j.machine === machineFilter;
  });

  const machineLabels: Record<MachineType, { label: string; icon: any }> = {
    plotter_corte: { label: 'Plotter de Corte (Silhouette/Cricut)', icon: Scissors },
    impressora_jato: { label: 'Impressora Jato de Tinta', icon: Printer },
    impressora_laser: { label: 'Impressora Laser', icon: Printer },
    laminadora: { label: 'Laminadora / Plastificadora BOPP', icon: Layers },
    encadernadora: { label: 'Encadernadora Wire-o', icon: Layers },
    prensa: { label: 'Prensa Térmica / Foil', icon: Sparkles }
  };

  const stepLabels = {
    arte: 'Arte / Ajuste',
    impressao: 'Impressão',
    corte: 'Corte na Plotter',
    laminacao: 'Laminação BOPP',
    montagem: 'Montagem Artesanal',
    embalagem: 'Embalagem Final',
    concluido: 'Pronto / Finalizado'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Esteira de Produção & Fila de Máquinas
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Organize etapas de impressão, corte de plotter, laminação e montagem artesanal.
          </p>
        </div>

        <button
          onClick={() => setIsAddJobOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Novo Job de Produção
        </button>
      </div>

      {/* Machine Filter Bar (Clean without redundant numbers) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs">
        <button
          onClick={() => setMachineFilter('all')}
          className={`px-3 py-2 rounded-xl font-semibold whitespace-nowrap transition-colors cursor-pointer ${
            machineFilter === 'all'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-xs'
          }`}
        >
          Todas as Máquinas
        </button>

        {Object.entries(machineLabels).map(([key, info]) => {
          const Icon = info.icon;
          return (
            <button
              key={key}
              onClick={() => setMachineFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                machineFilter === key
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold'
                  : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-xs'
              }`}
            >
              <Icon className="w-3.5 h-3.5 text-indigo-600" />
              <span>{info.label.split('(')[0].trim()}</span>
            </button>
          );
        })}
      </div>

      {/* Jobs Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredJobs.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 text-sm">
            Nenhuma tarefa de produção na fila no momento.
          </div>
        ) : (
          filteredJobs.map((job) => {
            const isCompleted = job.step === 'concluido';
            const MachineIcon = machineLabels[job.machine]?.icon || Scissors;

            return (
              <div
                key={job.id}
                className={`bg-white border ${isCompleted ? 'border-emerald-200 bg-emerald-50/20' : job.priority === 'urgent' ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'} rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-700 font-mono">
                      {job.orderNumber}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      job.priority === 'urgent'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {job.priority === 'urgent' ? 'Urgente' : 'Normal'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900">{job.productName}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Cliente: <strong className="text-slate-700">{job.customerName}</strong> {job.theme ? `• Tema: ${job.theme}` : ''}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <div className="text-slate-500">
                      <span>Equipamento:</span>
                      <div className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                        <MachineIcon className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="truncate">{machineLabels[job.machine]?.label.split('(')[0]}</span>
                      </div>
                    </div>

                    <div className="text-slate-500">
                      <span>Responsável:</span>
                      <div className="font-semibold text-slate-800 mt-0.5 truncate">{job.assignedTo || 'Geral'}</div>
                    </div>
                  </div>

                  {/* Step Progress Stepper */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-slate-500">Etapa Atual:</span>
                      <span className="font-bold text-indigo-700">{stepLabels[job.step]}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex border border-slate-200">
                      {['arte', 'impressao', 'corte', 'laminacao', 'montagem', 'embalagem', 'concluido'].map((s, idx) => {
                        const steps = ['arte', 'impressao', 'corte', 'laminacao', 'montagem', 'embalagem', 'concluido'];
                        const currentIdx = steps.indexOf(job.step);
                        const isDone = idx <= currentIdx;
                        return (
                          <div
                            key={s}
                            className={`flex-1 border-r border-slate-200 ${isDone ? 'bg-indigo-600' : 'bg-transparent'}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Prazo: {new Date(job.deadline).toLocaleDateString('pt-BR')}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!isCompleted ? (
                      <button
                        onClick={() => handleAdvanceStep(job)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                      >
                        Avançar &rarr;
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Concluído
                      </span>
                    )}

                    <button
                      onClick={() => {
                        if (confirm('Remover este job da esteira?')) {
                          onDeleteJob(job.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Job Modal */}
      <Modal
        isOpen={isAddJobOpen}
        onClose={() => setIsAddJobOpen(false)}
        title="Criar Tarefa de Produção"
        subtitle="Vincule a um pedido ou crie um job avulso de corte e impressão."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateJob} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Vincular a Pedido</label>
            <select
              value={selectedOrderId}
              onChange={(e) => handleOrderSelect(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-900"
            >
              <option value="">-- Tarefa Avulsa / Sem Pedido --</option>
              {orders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.orderNumber} - {o.customerName}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Produto *</label>
              <input
                type="text"
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tema / Arte</label>
              <input
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Equipamento / Máquina *</label>
              <select
                value={machine}
                onChange={(e: any) => setMachine(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-900"
              >
                {Object.entries(machineLabels).map(([k, info]) => (
                  <option key={k} value={k}>{info.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Prioridade</label>
              <select
                value={priority}
                onChange={(e: any) => setPriority(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-900"
              >
                <option value="normal">Normal</option>
                <option value="urgent">Urgente</option>
                <option value="low">Baixa</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Responsável / Operador</label>
              <input
                type="text"
                placeholder="Ex: Amanda (Corte)"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Data Limite de Produção</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-900"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAddJobOpen(false)}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-auto px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer flex items-center justify-center"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto min-h-[44px] sm:min-h-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center justify-center"
            >
              Lançar Job
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

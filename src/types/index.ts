export type OrderStatus = 
  | 'draft'               // Orçamento
  | 'pending_payment'    // Aguardando Pagamento / Sinal
  | 'art_creation'       // Em Criação de Arte
  | 'art_approval'       // Aguardando Aprovação do Cliente
  | 'art_approved'       // Arte Aprovada
  | 'in_production'      // Em Produção (Corte/Montagem)
  | 'ready'              // Pronto para Entrega/Envio
  | 'delivered'          // Entregue / Finalizado
  | 'cancelled';         // Cancelado

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';
export type PaymentMethod = 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'transfer' | 'link';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  theme: string;
  customizationText: string; // Ex: "Arthur - 5 Anos"
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  finishings: string[]; // Ex: "Laminação Holográfica", "Laço Cetim Duplo", "Shaker 3D"
  notes?: string;
  previewUrl?: string;
}

export interface ArtRevision {
  id: string;
  date: string;
  version: number;
  imageUrl?: string;
  feedback?: string;
  approved: boolean;
  status: 'pending' | 'approved' | 'rejected';
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerWhatsapp: string;
  customerEmail?: string;
  customerDocument?: string;
  eventDate?: string;
  deliveryDeadline: string;
  deliveryMethod: 'pickup' | 'delivery' | 'correios' | 'motoboy' | 'transportadora';
  shippingCost: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  discount: number;
  subtotal: number;
  totalAmount: number;
  notes?: string;
  items: OrderItem[];
  artRevisions: ArtRevision[];
  currentArtStatus: 'none' | 'draft' | 'waiting_client' | 'changes_requested' | 'approved';
  publicApprovalToken?: string;
  createdAt: string;
  updatedAt: string;
}

export type ProductCategory = 
  | 'topos_de_bolo'
  | 'caixas_luxo'
  | 'sacolas_lembrancinhas'
  | 'agendas_planners'
  | 'cadernos_bloquinhos'
  | 'adesivos_tags'
  | 'kits_festa'
  | 'convites'
  | 'brindes_corporativos'
  | 'cartonagem';

export interface MaterialRequirement {
  materialId: string;
  materialName: string;
  quantityNeeded: number;
  unit: string;
  estimatedCost: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  description: string;
  basePrice: number;
  costPrice: number;
  productionTimeMinutes: number;
  minQuantity: number;
  featuredImageUrl?: string;
  materials: MaterialRequirement[];
  suggestedMarkup: number; // Ex: 2.5 (150% profit)
  active: boolean;
}

export type MaterialCategory = 
  | 'papeis_especiais'
  | 'papeis_fotograficos'
  | 'laminacao_bopp'
  | 'fitas_aviamentos'
  | 'pedrarias_shakers'
  | 'ferragens_encadernacao'
  | 'colas_adesivos'
  | 'embalagens_envio'
  | 'tintas_toners';

export interface MaterialItem {
  id: string;
  code: string;
  name: string;
  category: MaterialCategory;
  unit: 'un' | 'fl' | 'm' | 'kg' | 'g' | 'pct' | 'rl';
  currentStock: number;
  minStock: number;
  unitCost: number;
  supplier?: string;
  location?: string;
  lastRestocked?: string;
}

export interface StockMovement {
  id: string;
  materialId: string;
  materialName: string;
  type: 'in' | 'out' | 'adjustment' | 'order_consumed';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  orderId?: string;
  date: string;
}

export type MachineType = 'plotter_corte' | 'impressora_jato' | 'impressora_laser' | 'laminadora' | 'encadernadora' | 'prensa';

export interface ProductionJob {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  productName: string;
  theme: string;
  quantity: number;
  machine: MachineType;
  step: 'arte' | 'impressao' | 'corte' | 'laminacao' | 'montagem' | 'embalagem' | 'concluido';
  priority: 'low' | 'normal' | 'urgent';
  estimatedMinutes: number;
  assignedTo?: string;
  deadline: string;
  startedAt?: string;
  completedAt?: string;
  notes?: string;
}

export type TransactionType = 'income' | 'expense';
export type TransactionCategory = 
  | 'venda_produtos'
  | 'sinal_pedido'
  | 'compra_materia_prima'
  | 'equipamentos_manutencao'
  | 'embalagens_frete'
  | 'marketing_anuncios'
  | 'custos_fixos_aluguel'
  | 'energia_internet'
  | 'prolabore_retirada'
  | 'outros';

export interface FinancialTransaction {
  id: string;
  description: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  date: string;
  paymentMethod: PaymentMethod;
  orderId?: string;
  customerOrSupplier?: string;
  status: 'pending' | 'completed';
  notes?: string;
}

export interface AtelierSettings {
  name: string;
  slogan: string;
  document: string; // CNPJ / CPF
  phone: string;
  email: string;
  address: string;
  pixKey: string;
  instagram: string;
  logoUrl: string;
  hourlyLaborRate: number; // Valor/hora de mão de obra (R$)
  defaultMarkup: number; // Multiplicador padrão
  daysForArt: number;
  daysForProduction: number;
  termsAndConditions: string;
}

export interface BulkTagItem {
  id: string;
  name: string;
  subtitle?: string;
  code?: string;
  quantity: number;
  tableOrGroup?: string;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestions?: string[];
}

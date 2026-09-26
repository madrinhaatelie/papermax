import React, { useState } from 'react';
import { Tag, Download, Sparkles, Trash2 } from 'lucide-react';
import { BulkTagItem, AtelierSettings } from '../../types';
import { generateTagsPdf } from '../../services/pdfGenerator';

interface BulkPersonalizationViewProps {
  settings: AtelierSettings;
}

export const BulkPersonalizationView: React.FC<BulkPersonalizationViewProps> = ({ settings }) => {
  const [tagItems, setTagItems] = useState<BulkTagItem[]>([
    { id: 'tag_1', name: 'Helena', subtitle: '1 Aninho', tableOrGroup: 'Mesa 01', quantity: 1 },
    { id: 'tag_2', name: 'Arthur', subtitle: 'Lembrancinha', tableOrGroup: 'Mesa 01', quantity: 1 },
    { id: 'tag_3', name: 'Isabela', subtitle: 'Lembrancinha', tableOrGroup: 'Mesa 02', quantity: 1 },
    { id: 'tag_4', name: 'Gabriel', subtitle: 'Lembrancinha', tableOrGroup: 'Mesa 02', quantity: 1 },
    { id: 'tag_5', name: 'Prof.ª Fernanda', subtitle: 'Dia dos Professores', tableOrGroup: 'Ensino Fundamental', quantity: 1 },
    { id: 'tag_6', name: 'Prof. Roberto', subtitle: 'Dia dos Professores', tableOrGroup: 'Ensino Médio', quantity: 1 }
  ]);

  const [pasteRawText, setPasteRawText] = useState('');
  const [bulkSubtitle, setBulkSubtitle] = useState('Lembrança Especial');

  // Parse bulk names from pasted lines
  const handleImportText = () => {
    if (!pasteRawText.trim()) return;

    const lines = pasteRawText.split('\n').filter(l => l.trim().length > 0);
    const newItems: BulkTagItem[] = lines.map((line, idx) => {
      const parts = line.split(/[,;\t-]/);
      return {
        id: 'tag_' + Date.now() + '_' + idx,
        name: parts[0]?.trim() || line.trim(),
        subtitle: parts[1]?.trim() || bulkSubtitle,
        tableOrGroup: parts[2]?.trim() || '',
        quantity: 1
      };
    });

    setTagItems([...tagItems, ...newItems]);
    setPasteRawText('');
  };

  const handleClearAll = () => {
    if (confirm('Limpar todas as tags da lista?')) {
      setTagItems([]);
    }
  };

  const handleDownloadPdf = () => {
    if (tagItems.length === 0) {
      alert('Adicione pelo menos um item à lista para gerar o PDF.');
      return;
    }
    generateTagsPdf(tagItems, settings);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Personalização em Lote & Tags em PDF
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cole listas de convidados ou nomes e gere folhas de impressão A4 com marcas de corte para guilhotina.
          </p>
        </div>

        <button
          onClick={handleDownloadPdf}
          className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Gerar Folha A4 em PDF
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form: Fast Text Importer */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 text-indigo-700 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            Importador de Nomes
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Subtítulo Padrão
            </label>
            <input
              type="text"
              value={bulkSubtitle}
              onChange={(e) => setBulkSubtitle(e.target.value)}
              placeholder="Ex: Obrigado pela presença! / 1 Aninho"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cole a lista de nomes (um por linha)
            </label>
            <textarea
              rows={6}
              value={pasteRawText}
              onChange={(e) => setPasteRawText(e.target.value)}
              placeholder="Exemplo:&#10;Alice Silva&#10;Bernardo Santos&#10;Clarice Lima - Mesa 03&#10;Daniel Oliveira - Padrinho"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-base sm:text-xs text-slate-900 placeholder-slate-400 font-mono"
            />
          </div>

          <button
            onClick={handleImportText}
            className="w-full min-h-[44px] sm:min-h-auto py-2.5 sm:py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center"
          >
            Processar e Adicionar à Fila
          </button>
        </div>

        {/* Right Preview Table: Tags in queue */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-600" />
                Tags para Impressão
              </h3>
              <p className="text-[11px] text-slate-500">Gabarito com 21 tags por folha A4 com marcas de corte.</p>
            </div>

            {tagItems.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs text-rose-600 hover:text-rose-800 font-medium cursor-pointer py-1 px-2"
              >
                Limpar lista
              </button>
            )}
          </div>

          {/* Tag Interactive Grid Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto p-1 custom-scroll">
            {tagItems.map((item) => (
              <div
                key={item.id}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 relative group hover:border-indigo-300 transition-colors shadow-xs"
              >
                <div className="w-2 h-2 rounded-full border border-slate-300 mx-auto mb-1.5" />
                <div className="text-[9px] text-indigo-700 font-bold uppercase tracking-wider text-center">
                  {settings.name}
                </div>
                <div className="font-bold text-slate-900 text-sm text-center mt-1 truncate">
                  {item.name}
                </div>
                <div className="text-[10px] text-slate-500 text-center truncate">
                  {item.subtitle} {item.tableOrGroup ? `[${item.tableOrGroup}]` : ''}
                </div>

                <button
                  onClick={() => setTagItems(tagItems.filter(t => t.id !== item.id))}
                  className="absolute top-2 right-2 text-slate-400 hover:text-rose-600 p-2 sm:p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
                  title="Remover tag"
                >
                  <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-rose-500 sm:text-slate-400 sm:hover:text-rose-600" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

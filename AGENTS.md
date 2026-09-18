# PAPER MAX — REGRA GLOBAL DE PADRÃO UI/UX E FUNCIONALIDADE

TODA nova página, módulo, submenu, lista, card, tabela, drawer, modal ou componente criado no PAPER MAX DEVE obedecer obrigatoriamente às regras abaixo.

Não criar apenas a aparência.
Toda interface criada deve possuir comportamento funcional real.

## 1. REGRA DOS CARDS E LINHAS

Sempre que um card ou linha representar um registro consultável:

* Clicar no corpo do card/linha = abrir Drawer de Consulta/Resumo;
* O Drawer deve mostrar os dados completos daquele registro;
* O clique no menu ⋮ não pode disparar o clique do card;
* Áreas de ação devem impedir propagação do clique (`e.stopPropagation()`);
* Cursor pointer somente quando houver ação real.

Nunca criar `cursor:pointer` em elemento sem funcionalidade.

## 2. REGRA DOS TRÊS PONTINHOS ⋮

Sempre que houver menu de três pontinhos, cada ação criada DEVE possuir implementação funcional real.

Padrão:

* ✏️ Editar → abrir Drawer/Formulário de edição com os dados daquele registro;
* 📋 Duplicar → criar novo registro independente, novo ID e persistir;
* 🗑️ Excluir → confirmação via `showConfirmDialog` + exclusão real + atualização da interface;
* 👁️ Ocultar/Ativar → alterar estado persistente (`active`, `status`), nunca apenas CSS;
* 📄 Resumo → abrir Drawer de consulta;
* Demais ações → somente criar se existir implementação real.

PROIBIDO criar um botão apenas visualmente.
Se uma ação não tiver implementação: NÃO criar o botão.

## 3. REGRA DOS DRAWERS

Todo Drawer deve:

* Abrir com os dados corretos do registro;
* Possuir título contextual;
* Possuir botão fechar;
* Fechar com X;
* Fechar com ESC (respeitando a hierarquia de camadas);
* Fechar pelo backdrop quando apropriado;
* Impedir eventos do conteúdo de fecharem acidentalmente;
* Funcionar em desktop e mobile;
* Não duplicar listeners.

## 4. REGRA DOS SUBMENUS

TODOS os submenus internos devem utilizar o padrão:

`[ DIVISÓRIA ] [ DIVISÓRIA ] [ DIVISÓRIA ]`

Estilo fichário horizontal.

Regras:

* Abas não selecionadas = cinza/neutras (`background: #f1f5f9` ou `#ffffff`, `color: var(--text-muted)`);
* Aba selecionada = destaque visual (`btn-primary` ou borda de destaque ativa);
* Disposição horizontal com overflow-x quando necessário;
* Ao clicar em uma nova divisória, a anterior perde o destaque/fecha;
* Apenas uma subaba fica ativa por vez;
* A subaba ativa deve ser preservada após ações internas e re-renderizações;
* NÃO utilizar `<select>` para substituir divisórias quando houver espaço suficiente.

## 5. REGRA DE LISTAS

A lista principal deve ser compacta.
Mostrar somente as informações essenciais para identificação rápida.

Exemplo:
`Produto | Quantidade disponível | ⋮`

Informações detalhadas ficam no Drawer.
Não transformar a listagem em uma ficha gigante.

## 6. REGRA DE AÇÕES

Todo botão deve ter uma função real.
Antes de criar qualquer botão, responder internamente:

* Qual função ele chama?
* Qual registro ele afeta?
* O que muda no armazenamento?
* O que muda visualmente?
* O que acontece depois?
* Existe confirmação?
* Existe tratamento de erro?

Se essas respostas não existirem, não criar o botão.

## 7. REGRA DE PERSISTÊNCIA

Qualquer ação chamada:
* Ocultar;
* Ativar;
* Editar;
* Duplicar;
* Excluir;
* Marcar como lido;
* Alterar status;

deve persistir no armazenamento utilizado pelo PAPER MAX (localStorage / state store).
Nunca considerar `display:none`, alteração de classe ou variável temporária como persistência.

## 8. REGRA DE RE-RENDERIZAÇÃO

Depois de qualquer ação:
* Atualizar somente o necessário;
* Preservar submenu ativo;
* Preservar filtros;
* Preservar busca;
* Preservar contexto do usuário;
* Não voltar automaticamente para a primeira aba;
* Não perder Drawer aberto sem motivo;
* Não duplicar event listeners.

## 9. REGRA DE CONFIRMAÇÃO

Não utilizar `window.confirm()` ou `window.alert()` quando existir componente visual próprio do PAPER MAX.
Utilizar o padrão visual existente de confirmação (`showConfirmDialog`) e notificações (`showToast`).

## 10. REGRA DE VALIDAÇÃO

Toda nova funcionalidade deve ser testada pelo comportamento real:
`Clique → ação → alteração → persistência → atualização visual`

## 11. REGRA DE NOVOS MÓDULOS

Antes de implementar uma nova página:
1. Identificar registros;
2. Definir consulta;
3. Definir Drawer;
4. Definir ações ⋮;
5. Definir submenus (fichário horizontal);
6. Definir persistência;
7. Definir estados;
8. Definir confirmações;
9. Definir estados vazios;
10. Definir erros;
11. Testar todas as ações.

## 12. REGRA DE PROIBIÇÃO DO CARACTERE '#' EM CÓDIGOS

PROIBIDO adicionar o caractere `#` antes ou junto a qualquer código, número de pedido, número de O.S., SKU, identificador ou referência gerado ou exibido no sistema.
Exemplo:
* Correto: `Pedido 1048`, `1048`, `OS 0012`
* Proibido: `Pedido #1048`, `#1048`, `#OS-0012`

## 13. REGRA DE FORMATAÇÃO E MÁSCARA DE NÚMEROS E DOCUMENTOS

TODOS os campos e exibições de contato e documentos em qualquer tela, cadastro, formulário, drawer ou modal DEVEM seguir estritamente o padrão:

* **CONTATO / WHATSAPP / TELEFONE**: `(XX) 9 XXXX-XXXX` (ou `(XX) XXXX-XXXX` para fixo);
* **CPF**: `XXX.XXX.XXX-XX`
* **CNPJ**: `XX.XXX.XXX/XXXX-XX`

O sistema deve aplicar máscara automática em tempo real durante a digitação/colagem e formatar os dados ao salvar, consultar e emitir comprovantes.

## REGRA FINAL

O PAPER MAX deve se comportar como UM ÚNICO SISTEMA.
Não criar cada página com um padrão diferente.
Reutilizar os componentes, comportamentos e padrões existentes sempre que possível.

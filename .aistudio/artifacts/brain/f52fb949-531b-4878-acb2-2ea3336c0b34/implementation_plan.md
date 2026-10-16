# Plano de Evolução Visual, Lançamentos em Abas, IA Aprimorada e Grid Gráfica 3x2

Plano detalhado para modernização do modo claro com tons off-white contemporâneos, reestruturação da tela de lançamentos com extrato e histórico em abas colapsáveis de largura total, aprimoramento das diretrizes e mecanismo do Chat Inteligente com prévia interativa em 1 clique, e reformulação da tela de gráficos em uma grade executiva 3x2 com Donut interativo de categorias.

---

### Decisões do Usuário & Alinhamento

> [!IMPORTANT]
> As seguintes decisões foram confirmadas pelo usuário durante a fase de alinhamento e regem a implementação:
>
> - **Alternância entre Extrato e Histórico**: Abas integradas com alternância direta e animada dentro do mesmo card ampliado de largura total, mantendo um modo ativo em destaque e o outro colapsado para eliminar rolagem vertical da página.
> - **Interação no Chat Inteligente**: Ao reconhecer uma transação em linguagem natural, o assistente exibirá um **balão de prévia interativa com confirmação em 1 clique** (`[Confirmar Lançamento]` e `[Cancelar]`), garantindo precisão antes de gravar no banco de dados.
> - **Distribuição da Grade 3x2 de Gráficos**:
>   - Linha Superior:
>     - 2 primeiros blocos (col-span-2): **Gráfico de Fluxo Financeiro** (Receitas vs Despesas mensal).
>     - 3º bloco (col-span-1): **Gráfico de Pizza / Donut de Categorias** com percentuais e distribuição.
>   - Linha Inferior (3 blocos):
>     - Bloco 1: **Comparativo Mensal** (evolução percentual vs mês anterior e ticket médio).
>     - Bloco 2: **Balanço Líquido & Taxa de Poupança** (margem de sobra real vs metas).
>     - Bloco 3: **Projeção de Fluxo de Caixa** (estimativa baseada nos hábitos históricos).
> - **Tons de Branco Off-White**: Substituição dos tons frios e acinzentados do modo claro por paleta off-white nobre (`#FBFBF9`, `#F5F4EE`, `#ECE9E2`), garantindo conforto ocular superior e acabamento premium.

---

## 1. Visão Geral e Conceito Central

- **O que faz**: Otimiza a ergonomia visual do FintechCore em 4 frentes sinérgicas: conforto estético no modo claro (off-white), densidade de tela perfeita na gestão de extrato/lançamentos sem rolagem, inteligência natural avançada no chat com prévias acionáveis e visualização analítica em matriz 3x2.
- **Público-alvo**: Usuários que buscam uma ferramenta financeira veloz, com leitura confortável em telas claras, navegação ágil sem perda de foco vertical e suporte de IA conversacional resolutivo.
- **Valor Principal**: Eliminação definitiva da rolagem desnecessária, maior clareza analítica com novos gráficos de composição e redução de atrito na inserção de transações por voz ou texto.

---

## 2. Experiência do Usuário & Design Visual

### A. Paleta Off-White no Modo Claro
- **Fundo da Aplicação**: `#F8F7F3` (Off-white aconchegante com toque neutro suave).
- **Superfícies de Cards e Sidebar**: `#FFFFFF` / `#FCFBF8` com bordas sutis em `#E6E3DA` (elimina o contraste áspero do branco puro sem perder luminosidade).
- **Acentos e Destaques no Claro**: `#32323F` (Gunmetal elegante para textos primários) e `#4C4E5D` para controles secundários.
- **Modo Escuro**: Mantém a paleta Gunmetal (`#32323F`, `#252530`, `#4C4E5D`, `#988E96`, `#DDD5D0`) já consolidada.

### B. Tela de Lançamentos & Extrato (Ergonomia Sem Rolagem)
- **Card de Inserção Rápida (TransactionForm)**: Reajustado para proporção harmoniosa de topo/lateral com seletores compactos e feedback rápido.
- **Card Ampliado de Movimentações (TransactionTable)**:
  - Ocupa a largura total proporcional disponível.
  - Cabeçalho com abas integradas estilo switcher executivo:
    - `[ 📄 Extrato do Mês Atual (N lançamentos) ]`
    - `[ 🔍 Histórico Geral & Pesquisa Global ]`
  - Apenas o extrato selecionado é expandido; o outro fica recolhido sem ocupar altura vertical.
  - Contêiner de tabela com altura fixa contida (`max-h-[460px] overflow-y-auto custom-scrollbar`) e cabeçalho `sticky`, permitindo navegar por dezenas de transações mantendo toda a tela estática.

### C. Chat Inteligente Aprimorado (PersonalAIAdvisor)
- **Compreensão de Linguagem Natural Brasileira**:
  - Padrões ricos: *"gastei 48 no almoço hoje no cartão santander"*, *"recebi 3500 de salário ontem na conta corrente"*, *"comprei tênis 280 em 2x despesa lazer"*, *"paguei conta de luz 190,50"*.
  - Detecção automática de:
    - `tipoItem`: Receita ou Despesa.
    - `valor`: Conversão de formatos brasileiros (`R$ 45,90`, `45.90`, `50 conto`).
    - `categoria`: Reconhecimento semântico inteligente baseado na lista ativa de categorias do usuário.
    - `accountId`: Vínculo automático à conta/cartão mencionada (Santander, Inter, Nubank, Dinheiro, etc.).
    - `data`: Conversão de termos relativos ("hoje", "ontem", "anteontem") para `YYYY-MM-DD`.
    - `faturaMes`: Detecção de compras parceladas ou em fatura futura.
- **Balão de Prévia Interativo**:
  - Em vez de gravar cegamente, o bot responde com um card visual estilizado mostrando todos os dados extraídos:
    - Descrição, Categoria, Conta/Cartão, Data e Valor formatado em reais.
    - Botão verde destacado: `[✓ Confirmar e Lançar]`
    - Botão neutro: `[✕ Descartar]`
  - Ao clicar em confirmar, a transação é inserida instantaneamente no Firestore/Local e o card atualiza para o estado `[✓ Lançado com Sucesso]`.

### D. Tela de Gráficos em Matriz 3x2 (FinancialCharts)
- Layout em proporção equilibrada (3 colunas horizontais x 2 linhas verticais):
  ```
  ┌────────────────────────────────────────────────────────────────────────┐
  │                           TELA DE GRÁFICOS (3x2)                       │
  ├──────────────────────────────────────────┬─────────────────────────────┤
  │ FLUXO FINANCEIRO MENSAL (Col 1 e Col 2)   │ DONUT DE CATEGORIAS (Col 3) │
  │ • Comparativo Receitas x Despesas        │ • Distribuição percentual   │
  │ • Linha de Saldo / Tendência             │ • Legenda interativa        │
  │ • Controles de visão (3M / 6M / 12M)     │ • Hover com detalhe e total │
  ├────────────────────────────┬─────────────┴──────────────┬──────────────┤
  │ COMPARATIVO MENSAL (Col 1) │ BALANÇO LÍQUIDO (Col 2)    │ PROJEÇÃO (3) │
  │ • Variação percentual      │ • Taxa de Poupança         │ • Estimativa │
  │ • Médias diárias e mensais │ • Sobra Real vs Meta       │ • Tendência  │
  └────────────────────────────┴────────────────────────────┴──────────────┘
  ```
- **Transições Suaves**: Animações de entrada e troca de mês via `framer-motion`/`motion/react` com micro-interações ao passar o mouse sobre fatias e barras.

---

## 3. Decisões do Produto & Trade-Offs

- **Abas Integradas no Extrato**:
  - *Abordagem*: Um único card principal na área de extrato com toggle de abas integradas para alternar entre "Extrato do Período" e "Histórico Geral".
  - *Por que*: O usuário confirmou essa preferência; evita qualquer rolagem de página para baixo e unifica a largura visual dos relatórios tabulares.
- **Balão de Prévia Interativa no Chat**:
  - *Abordagem*: Geração de componente de confirmação em 1 clique na mensagem do chat antes de salvar.
  - *Por que*: Elimina erros de interpretação sem exigir digitação extra do usuário, fornecendo controle total com 1 toque.
- **Matriz 3x2 para Gráficos**:
  - *Abordagem*: Grid com 3 colunas e 2 linhas no desktop, condensando o fluxo financeiro em 2 colunas e complementando com donut e 3 cards analíticos funcionais na base.
  - *Por que*: Otimiza o viewport de laptops e desktops, eliminando a necessidade de scrollar a tela para ver relatórios essenciais.

---

## 4. Arquitetura Técnica & Estrutura de Componentes

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              APP COMPONENT TREE                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ App.tsx (Root Shell: h-screen overflow-hidden)                                │
│ ├─ SidebarNavigation (Desktop / Mobile Drawer)                                │
│ ├─ TopHeaderBar (Data, Notificações, Streak, Firebase, Theme Toggle)          │
│ ├─ TopTabsMenu (Visão Geral, Gráficos, Calendário, Cartões)                   │
│ └─ Main Content Area                                                         │
│     ├─ Tab: Visão Geral (5 MetricCards, SubPanels, Quick Ledger)             │
│     ├─ Tab: Gráficos & Relatórios (FinancialCharts: Grid 3x2 + Donut)        │
│     ├─ Tab: Calendário Financeiro (ExpenseCalendar)                          │
│     └─ Nav: Lançamentos & Extrato                                            │
│         ├─ TransactionForm                                                   │
│         └─ TransactionTable (Abas integradas: Mês vs Histórico Global)       │
│                                                                              │
│ PersonalAIAdvisor.tsx (Chat NLP Engine + Interactive Confirmation Balloon)    │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Mapeamento de Estado e Gatilhos
- `src/index.css`: Definição das variáveis de cor off-white no `@layer base` e tema Tailwind v4.
- `src/components/TransactionTable.tsx`: Estado local `activeLedgerView: 'mes' | 'historico'` com largura 100% harmonizada e transição fluida.
- `src/components/FinancialCharts.tsx`: Implementação da grade `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5` contendo o fluxo em `lg:col-span-2`, donut em `lg:col-span-1`, e os 3 cards secundários na linha 2.
- `src/components/PersonalAIAdvisor.tsx`: Parser regex e semântico calibrado em português + tipo de mensagem `action_preview` com callback `onAddTransaction` ao clicar em confirmar.

---

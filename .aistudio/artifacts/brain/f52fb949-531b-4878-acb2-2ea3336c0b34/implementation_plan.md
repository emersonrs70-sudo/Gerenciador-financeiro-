# Repaginação Visual e Arquitetural do Sistema Financeiro (SaaS Dashboard)

Plano de modernização visual e reestruturação de layout para transformar o sistema em um dashboard financeiro de nível corporativo/SaaS, eliminando a rolagem vertical desnecessária através de abas no menu superior, introduzindo uma barra lateral persistente com navegação categorizada e aplicando a nova paleta de cores corporativa com alta precisão e legibilidade.

---

### Decisões do Usuário & Alinhamento

> [!IMPORTANT]
> As decisões a seguir foram confirmadas pelo usuário durante a fase de alinhamento e servem como premissas fundamentais da implementação:

- **Organização do Menu Superior**: Cada módulo (Visão Geral, Gráficos & Relatórios, Calendário Financeiro, Faturas de Cartão) terá abas exclusivas no topo, eliminando a necessidade de rolar para baixo para acessar gráficos ou calendário.
- **Formato do Menu Lateral**: Barra lateral persistente (sempre visível), contendo ícones e rótulos de texto claros, permitindo navegação rápida entre as grandes áreas (Dashboard, Lançamentos, Planejamento & Sonhos, Contas & Categorias, Assistente IA e Sincronização Nuvem).
- **Comportamento de Rolagem (Viewport Presence)**: Estrutura em altura proporcional à tela (`h-screen overflow-hidden`), onde cada área do dashboard se ajusta ao viewport e a rolagem ocorre exclusivamente dentro dos contêineres de tabelas e listas de transações.
- **Paleta de Cores Estrita**:
  - `#32323F` (Gunmetal / Charcoal Dark) — Fundo principal, barra lateral e containers de alta ênfase.
  - `#4C4E5D` (Davy's Gray) — Superfícies de cartões estruturais, bordas sutis e botões secundários.
  - `#988E96` (Taupe Gray) — Textos secundários, metadados legíveis e divisores de seção.
  - `#BCABA8` (Silver Pink) — Acentos suaves, estados ativos de abas, destaques de foco.
  - `#DDD5D0` (Timberwolf) — Tipografia primária de alto contraste e legibilidade.
  - Ícones com cores semânticas discretas (verde suave para receitas, coral suave para despesas, azul suave para investimentos).

---

## 1. Visão Geral e Conceito Central

- **O que faz**: Reestrutura a experiência do usuário do sistema financeiro para um formato SaaS de tela cheia, integrando métricas em tempo real, gestão de transações, análise gráfica de desempenho e calendário financeiro em abas dedicadas e painéis contidos, sem perda de contexto ou rolagem longa.
- **Público-alvo**: Usuários que demandam controle financeiro diário ágil, visualização imediata do fluxo de caixa e gestão de metas sem poluição visual.
- **Valor Principal**: Eliminação da fadiga de rolagem, clareza hierárquica imediata, contraste visual profissional e navegação fluida entre os módulos do sistema.

---

## 2. Experiência do Usuário & Design Visual

### Fluxos Principais
1. **Navegação Primária (Menu Lateral)**:
   - Acesso direto às seções estruturais: *Visão Geral Financeira*, *Transações & Extrato*, *Metas & Sonhos*, *Contas Bancárias*, *Categorias*, *Assistente Pessoal*, *Sincronização Firebase*.
   - Exibição de perfil e status da sincronização em tempo real (Firebase Firestore / Nuvem) no rodapé da barra lateral.
2. **Navegação Secundária no Dashboard (Menu Superior de Abas)**:
   - **Aba 1: Visão Geral**: Métricas consolidadas (Saldo, Entradas, Saídas, Investimentos, Taxa de Poupança) + Formulário rápido de novo lançamento + Tabela de transações recentes com paginação/rolagem interna.
   - **Aba 2: Gráficos & Relatórios**: Painéis analíticos completos (Despesas por categoria, Evolução mensal, Comparativo receitas vs despesas, Projeções) ocupando a altura da tela com controles de período.
   - **Aba 3: Calendário Financeiro**: Calendário mensal expandido mostrando vencimentos, recebimentos previstos e saldo projetado por dia, sem comprimir outras visões.
   - **Aba 4: Cartões de Crédito**: Gestão das faturas vigentes, limites, datas de fechamento e compras parceladas.
3. **Rolagem Contida**:
   - A casca principal do app é fixa (`h-screen overflow-hidden flex`).
   - Apenas o miolo de conteúdo ativo ou a lista de registros rola (`overflow-y-auto custom-scrollbar`), mantendo cabeçalhos, filtros e barras sempre visíveis.

### Identidade Visual & Tema
- **Aparência**: Minimalista, executiva, corporativa contemporânea (Fintech / Executive Dashboard).
- **Tipografia**: Hierarquia balanceada com fontes sem serifa modernas e algarismos estritamente tabulares (`tabular-nums font-mono`) para alinhamento perfeito de valores em reais.
- **Tratamento Anti-Slop**:
  - Sem badges estáticas desnecessárias ou pílulas coloridas artificiais.
  - Bordas ultrafinas (`1px solid #4C4E5D/40`) e superfícies planas sem sombras exageradas.
  - Ícones semânticos com opacidade calibrada para não sobrecarregar a paleta `#32323F`.

---

## 3. Decisões do Produto & Trade-Offs

- **Menu Superior Baseado em Abas de Módulo**:
  - *Abordagem*: Isolar Gráficos, Calendário e Faturas em abas exclusivas no topo da tela do Dashboard.
  - *Por que*: Atende diretamente ao requisito de eliminar rolagem vertical excessiva, permitindo que cada ferramenta tenha espaço dedicado para visualizações ricas.
  - *Alternativa descartada*: Manter tudo empilhado verticalmente com rolagem infinita.
- **Barra Lateral Persistente**:
  - *Abordagem*: Manter a barra lateral de 240px–260px com ícone + nome legível sempre presentes no desktop, adaptando-se para recolhimento responsivo em telas menores.
  - *Por que*: Oferece previsibilidade de navegação e elimina cliques adicionais para abrir gavetas laterais.
- **Preservação de Todas as Funcionalidades e Conexão Firebase**:
  - *Abordagem*: Nenhuma regra de negócio, integração do Firebase Auth/Firestore, cálculo de saldos, importação de extrato PDF ou gerenciamento de categorias será alterada ou removida.

---

## 4. Arquitetura Técnica & Estrutura de Componentes

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 APP VIEWPORT (100vh)                                   │
├──────────────┬─────────────────────────────────────────────────────────────────────────┤
│ SIDEBAR      │ TOP HEADER                                                              │
│ (#32323F)    │ [Módulo Ativo]   [Seletor Mês/Ano]  [Firebase Status] [Tema] [Notific.] │
│              ├─────────────────────────────────────────────────────────────────────────┤
│ • Logo       │ TABS DO MENU SUPERIOR                                                   │
│ • Dashboard  │ [ Visão Geral ]  [ Gráficos & Relatórios ]  [ Calendário ]  [ Faturas ] │
│ • Transações ├─────────────────────────────────────────────────────────────────────────┤
│ • Sonhos     │ ÁREA DE CONTEÚDO ATIVO (h-full overflow-hidden / rolagem interna)       │
│ • Contas     │                                                                         │
│ • Categorias │ ┌──────────────────────┐  ┌───────────────────────────────────────────┐ │
│ • Assistente │ │ Cartões de Métricas  │  │ Visualização Específica da Aba Selecionada│ │
│              │ │ (Saldo, Entradas,    │  │ (Tabela contida, Gráficos em tela cheia   │ │
│ ──────────── │ │  Saídas, Poupança)   │  │  ou Calendário Mensal Completo)           │ │
│ • Usuário    │ └──────────────────────┘  └───────────────────────────────────────────┘ │
│ • Nuvem Sync │                                                                         │
└──────────────┴─────────────────────────────────────────────────────────────────────────┘
```

### Mapeamento de Estado e Visualizações
- `activeNavSection`: Alterna entre a visão principal do Dashboard, Gestão de Sonhos/Metas, Contas/Categorias, e Assistente IA.
- `activeDashboardTab`: Controla a aba do topo no Dashboard (`overview` | `charts` | `calendar` | `invoices`).
- `filteredTransactions`: Continua alimentando reativamente as métricas, a tabela com rolagem contida, os gráficos interativos e o calendário sem recarregar a página.

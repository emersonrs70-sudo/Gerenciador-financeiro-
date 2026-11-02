# Saldo Cronológico por Conta e Ajuste Responsivo do Histórico Mobile

Este plano detalha as melhorias no histórico de transações para calcular e exibir o saldo específico da respectiva conta após cada lançamento (evitando o acúmulo genérico) e corrigir o transbordo das bordas do card em telas mobile.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Decisão sobre a exibição de saldo por lançamento**: 
> - Cada transação pertence a uma conta específica (`item.accountId`). O sistema agora mantém o extrato cronológico individualizado de cada conta bancária a partir de seu `saldoInicial`, garantindo que uma transação da Conta A exiba o saldo da Conta A imediatamente após aquela transação (ex: R$ 100 inicial + R$ 10 Pix = R$ 110 exibido logo abaixo de +R$ 10,00).
> - Para cartões de crédito, será exibida a fatura acumulada do cartão correspondente após o lançamento.
> - Na visualização mobile do Histórico Geral, a barra de busca e o seletor de categorias serão ajustados com `w-full min-w-0` e layout flex-col responsivo para assegurar contenção estrita dentro das margens do card.

---

## 1. Overview & Core Concept

- **O que faz**:
  1. No Extrato do Período e no Histórico Geral (tanto no mobile quanto no desktop), abaixo do valor da transação (+ R$ X ou - R$ Y), exibe o saldo exato que aquela conta passou a ter imediatamente após a execução do lançamento.
  2. Redimensiona e ajusta os limites do Histórico Geral em smartphones, eliminando o estouro horizontal que ultrapassava as bordas do card contenedor.
- **Público-alvo**: Usuários que controlam múltiplas contas bancárias e precisam conferir o saldo resultante de cada movimentação como em um extrato bancário oficial.
- **Principal valor**: Rastreabilidade precisa de cada movimentação sem inconsistências de saldos consolidados misturados e usabilidade mobile perfeita sem rolagem lateral indesejada.

---

## 2. User Experience & Visual Design

- **Exibição do Saldo por Lançamento**:
  - No valor da transação:
    - Linha superior: Valor do lançamento em negrito (`+ R$ 10,00` em verde ou `- R$ 45,00` em vermelho).
    - Linha inferior: Saldo resultante daquela conta em tipografia mono discreta (`Saldo: R$ 110,00` ou para cartões `Fatura: R$ 145,00`).
  - No modo **Consolidado**, o saldo exibido abaixo é o saldo da **conta do lançamento** (ex: se o Pix foi no Santander, exibe o saldo do Santander naquele instante; se o almoço foi no Nubank, exibe o saldo do Nubank naquele instante).
- **Correção da Interface Mobile**:
  - No Histórico Geral em telas pequenas (`sm` e menores), a barra de pesquisa (`Search`) e o filtro de categoria (`Select`) passam a ocupar `w-full` empilhados, sem restrições de `min-w-[180px]` que forçavam a expansão da largura da tela.
  - A coluna do container pai em `App.tsx` recebe `min-w-0 max-w-full overflow-hidden`, eliminando o overflow de grid nativo do CSS.
  - As listas com scroll em `TransactionTable.tsx` recebem contenção estrita (`w-full max-w-full overflow-x-hidden`).

---

## 3. Key Product Decisions & Trade-Offs

- **Cálculo por Conta vs. Consolidado Linear**:
  - *Abordagem escolhida*: Calcular cronologicamente (`data` + `created_at` / `id`) a timeline individual de cada conta bancária a partir de seu `saldoInicial`.
  - *Motivo*: Atende diretamente ao requisito de que a Conta A com 100 ao receber 10 mostre 110, mesmo se houver transações de outras contas intercaladas no mesmo dia.
- **Contenção CSS Grid no Mobile**:
  - *Abordagem escolhida*: Aplicar `min-w-0` no grid item pai (`lg:col-span-8`) e `flex-col sm:flex-row` no cabeçalho do Histórico Geral.
  - *Motivo*: No padrão CSS Grid, os itens possuem `min-width: auto` por padrão; qualquer elemento interno com largura mínima rígida faz a coluna expandir além da viewport mobile.

---

## 4. Technical Architecture & Data Strategy

```
┌──────────────────────────────────────────────────────────────┐
│                    TransactionTable                          │
│                                                              │
│  1. Agrupamento cronológico por accountId:                   │
│     accounts.forEach(acc => {                                │
│       let running = acc.saldoInicial;                        │
│       txsOfAccount.forEach(tx => {                           │
│         running += (tx.tipoItem === 'receita' ? +val : -val);│
│         accountTransactionBalances[tx.id] = running;         │
│       });                                                    │
│     });                                                      │
│                                                              │
│  2. Renderização nos cards e tabelas:                        │
│     ┌────────────────────────────────────────────────────┐   │
│     │ Descrição Transação                     + R$ 10,00 │   │
│     │ Categoria · Conta                   Saldo: R$ 110  │   │
│     └────────────────────────────────────────────────────┘   │
│                                                              │
│  3. Contenção Mobile (w-full, min-w-0, flex-col sm:flex-row) │
└──────────────────────────────────────────────────────────────┘
```

- **Mapeamento de Estado e Arquivos Impactados**:
  - `src/components/TransactionTable.tsx`:
    - Atualizar a lógica de `transactionBalances` para calcular o saldo cronológico de cada conta individualmente a partir de `acc.saldoInicial`.
    - Exibir o saldo resultante no Histórico Geral (mobile e desktop) e no Extrato.
    - Atualizar classes dos inputs da aba `historico` para `w-full min-w-0` e ajustar o container mobile para impedir transbordo.
  - `src/App.tsx`:
    - Adicionar `min-w-0 max-w-full overflow-hidden` no container da coluna da tabela de transações.

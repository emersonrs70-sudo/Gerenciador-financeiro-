# Plano de Implementação: Reorganização da Aba Faturas e Cartão

Reestruturar a aba de "Faturas e Cartão" para exibir as informações da fatura estritamente alinhadas com o mês e ano selecionados na régua da página Dashboard, utilizando toda a área disponível da tela em um layout em colunas lado a lado sem scroll de página.

---

## 1. Visão Geral das Mudanças

1. **Sincronização com a Régua de Meses do Dashboard**:
   - Em vez de listar meses passados e futuros empilhados, o componente receberá `currentMonth` e `currentYear`.
   - A competência da fatura exibida corresponderá exatamente ao mês selecionado pelo usuário na régua do Dashboard (ex: `2026-11`), recalculando em tempo real o valor da fatura, compras vinculadas, pagamentos já efetuados e status.
2. **Card Principal em Tela Cheia (Zero Page Scroll)**:
   - A aba utilizará toda a altura da viewport disponível (`h-[calc(100vh-170px)]` no desktop com transição responsiva no mobile).
   - O scroll existirá apenas internamente na lista de transações da fatura na coluna da direita, eliminando qualquer rolagem indesejada na página principal.
3. **Divisão do Espaço Interno em Colunas Lado a Lado**:
   - **Coluna Esquerda (~38% da largura)**:
     - Seletor horizontal de cartões de crédito (quando houver mais de um cartão cadastrado).
     - Cartão virtual premium com detalhes da conta (limite total, limite disponível, datas de fechamento e vencimento).
     - Barra de progresso de limite consumido.
     - Bloco principal da Fatura do Mês com status (Aberta, Fechada ou Paga), valor em destaque mono e botão para pagar a fatura.
   - **Coluna Direita (~62% da largura)**:
     - Cabeçalho do Extrato com identificação do mês/ano, contagem de registros e total somado.
     - Lista de compras e estornos daquela fatura específica com scroll vertical interno dedicado.
     - Identificação de compras feitas após o fechamento (`pós-fechamento`).
     - Estado vazio com orientação contextual caso o mês não possua lançamentos.

---

## 2. Detalhes de Arquitetura e Componentes

### 2.1. Alterações em `src/App.tsx`
- No bloco `{dashboardTab === 'cartoes'}`:
  - Substituir o `.map()` empilhado de múltiplos cartões por uma instância centralizada de `CreditCardBills`.
  - Passar as props:
    - `currentMonth={currentMonth}`
    - `currentYear={currentYear}`
    - `creditAccounts={accounts.filter(a => a.tipo === 'credito')}`
    - `activeAccountId={selectedAccountId}` (para sincronizar seleção se um cartão for selecionado na sidebar)
    - `checkingAccounts={accounts.filter(a => a.tipo !== 'credito')}`
    - `transactions={transactions}`
    - `accountBalances={accountBalances}`
    - `onAddTransaction={handleAddTransaction}`

### 2.2. Reescrita de `src/components/CreditCardBills.tsx`
- **Novo Gerenciamento de Estado**:
  - `selectedCardId`: estado local para a aba do cartão ativo, inicializado com o cartão selecionado na sidebar ou o primeiro cartão disponível.
- **Cálculo da Fatura do Mês Selecionado**:
  - Determinação da competência da fatura: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`.
  - Filtragem das transações daquele cartão que pertencem a essa competência (através de `t.faturaMes || getBillMonthForDate(t.data, closingDay)`).
  - Cálculo de compras (`despesa`), pagamentos (`receita`) e saldo devedor.
  - Regra de status precisa: Paga, Fechada/Pendente ou Em Aberto.
- **Layout Estrutural**:
  - Container flex principal: `h-full min-h-[580px] max-h-[calc(100vh-175px)] flex flex-col`.
  - Seletor de abas horizontais no topo com suporte a múltiplos cartões e botão de adicionar novo cartão.
  - Grid ou Flex horizontal `flex-1 min-h-0 flex flex-col lg:flex-row gap-5 overflow-hidden`.
  - Coluna da esquerda com painel de métricas e cartão gráfico.
  - Coluna da direita com tabela/lista de transações com `overflow-y-auto` interno.

---

## 3. Plano de Verificação

1. **Compilação e Linter**:
   - Executar `compile_applet` e `lint_applet` para assegurar integridade de tipos TypeScript.
2. **Validação de Fluxos de Uso**:
   - Navegar na régua de meses do Dashboard (ex: alternar entre Outubro, Novembro, Dezembro) e verificar se a fatura do cartão atualiza imediatamente com as compras e valores do mês correspondente.
   - Alternar entre cartões caso haja mais de um cartão cadastrado utilizando as abas horizontais.
   - Verificar se a página não gera barra de scroll vertical externa e se o extrato da fatura rola suavemente dentro de seu contêiner.
   - Testar o modal de pagamento de fatura ("Pagar Fatura") garantindo débito na conta corrente e liquidação da fatura.

# Plano de Implementação: Projeção de Saldo e Fatura no Gráfico de Fluxo Financeiro

Adicionar ao gráfico de evolução temporal (em "Gráficos & Relatórios") uma série visual contínua que demonstra a evolução real do saldo da conta ao longo do período selecionado (ou a evolução da fatura mensal para contas do tipo cartão de crédito), com eixo Y independente, estilização em tons de cinza e persistência mesmo quando filtros de categoria estiverem ativos.

---

## 1. Visão Geral da Funcionalidade

- **Saldo em Conta Contínuo**:
  - Para contas correntes, carteiras físicas ou visão consolidada: calcula o saldo acumulado dia a dia a partir do saldo inicial e de todas as receitas e despesas efetuadas até cada data.
  - Demonstra visualmente como o saldo subiu ou desceu ao longo do período (últimos 7 dias, 15 dias, mês selecionado, 3 meses ou ano).
- **Fatura do Cartão de Crédito**:
  - Para contas do tipo `credito`, a linha representa o valor acumulado da fatura corrente até aquela data (compras no crédito acumuladas menos eventuais pagamentos/estornos).
- **Independência de Filtros de Categoria**:
  - Quando o usuário filtrar por uma ou mais categorias específicas (ex: "Alimentação"), as barras/áreas de *Receitas* e *Despesas* exibem apenas os valores da categoria selecionada, enquanto a linha de *Saldo / Fatura* permanece visível refletindo a saúde financeira global da conta selecionada.
- **Eixo Y Independente (Dual Y-Axis)**:
  - **Eixo Esquerdo (Left)**: Escala monetária dos fluxos pontuais do período (Receitas e Despesas diárias/agrupadas).
  - **Eixo Direito (Right)**: Escala monetária do saldo acumulado / fatura, com formatação monetária compacta (`R$ ...`), evitando que a magnitude do saldo achate as barras/áreas de despesas diárias.
- **Design Visual**:
  - Curva contínua no mesmo padrão das existentes (`type="monotone"`).
  - Tom de cinza neutro e elegante (`#71717A` / `#9CA3AF`).
  - Preenchimento gradiente suave e sombreado abaixo da linha (`opacity 0.25` a `0.00`).
  - Tooltip integrado e legenda com badge estilizado.

---

## 2. Detalhes Técnicos e Arquitetura

### 2.1. Arquivo de Destino
- `src/components/FinancialCharts.tsx`

### 2.2. Algoritmo de Cálculo de Saldo Acumulado
1. **Identificação da Conta**:
   - Se `selectedAccountId === 'consolidado'`: soma os saldos iniciais de todas as contas não-crédito e computa todas as movimentações.
   - Se `tipo === 'credito'`: acumula os gastos no crédito do mês de referência (tamanho da fatura progressivo).
   - Se conta bancária padrão: obtém `saldoInicial` da conta + soma de transações passadas anteriores ao período de corte para saber o saldo no início do intervalo, e vai acumulando dia a dia.
2. **Enriquecimento dos Dados (`fluxoData`)**:
   - Cada ponto do array `fluxoData` conterá:
     ```ts
     {
       lbl: string, // ex: "05/11" ou dia do mês
       dateKey: string, // "YYYY-MM-DD"
       Receita: number, // Filtrado por categoria (se houver)
       Gasto: number, // Filtrado por categoria (se houver)
       Saldo: number, // Saldo acumulado real / Fatura acumulada da conta
     }
     ```
3. **Componentes Recharts**:
   - `<defs>`: inclusão do gradiente `colorSaldo` (`#71717A` para `rgba(113, 113, 122, 0.0)`).
   - `<YAxis yAxisId="left" orientation="left" ... />` para Receita e Gasto.
   - `<YAxis yAxisId="right" orientation="right" ... />` com formatação monetária limpa para o Saldo/Fatura.
   - `<Area yAxisId="right" dataKey="Saldo" name={isCreditCard ? "Fatura do Mês" : "Saldo em Conta"} stroke="#71717A" strokeWidth={2} fill="url(#colorSaldo)" dot={false} activeDot={{ r: 4, fill: '#71717A' }} />`.
   - Tooltip customizado formatando os 3 valores de forma clara e visualmente balanceada.

---

## 3. Plano de Verificação

1. **Compilação e Linter**:
   - Executar `compile_applet` e `lint_applet` para assegurar ausência de erros de tipagem TypeScript ou importações.
2. **Validação de Cenários de Uso**:
   - Selecionar conta bancária padrão: verificar se o saldo inicial + movimentações refletem com exatidão a curva de saldo.
   - Filtrar categorias: verificar se a linha cinza de saldo permanece inalterada enquanto as receitas/despesas se ajustam à categoria.
   - Selecionar conta do tipo Cartão de Crédito: verificar se a legenda e o valor mostram a progressão da fatura do mês.
   - Alternar períodos (7 dias, 15 dias, Mês, 3 Meses, Ano): confirmar que a interpolação do saldo acumulado flui perfeitamente no gráfico.

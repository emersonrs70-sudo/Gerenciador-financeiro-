# Plano de Implementação — 5 Melhorias do Sistema FintechCore

Com base nas preferências confirmadas, este plano detalha a arquitetura e as alterações para implementar as 5 melhorias solicitadas.

---

## 1. Limpeza Definitiva de Metas e Sonhos Fictícios
- **Diagnóstico:** As metas fictícias de exemplo (`p1` "Viagem de Fim de Ano" e `p2` "Notebook Novo") voltavam quando o listener do Firestore sincronizava dados antigos salvos no perfil do usuário (`users/{uid}/projects`).
- **Ações:**
  1. No `src/App.tsx`, no callback `onProjects` da sincronização em tempo real do Firestore, filtrar e ignorar os IDs/nomes fictícios e invocar `deleteProjectFromFirestore(uid, p.id)` para expurgá-los definitivamente da nuvem.
  2. Limpar o cache local `local_projects_${user.email}` na inicialização para garantir que o usuário inicie apenas com metas criadas por ele mesmo.
  3. Manter a lista padrão `DEFAULT_PROJETOS = []` em `src/lib/firebase.ts`.

---

## 2. Expansão de Cores Primárias para Bancos Brasileiros em Contas & Cartões
- **Diagnóstico:** O seletor de cores possuía apenas 6 opções básicas em formato de texto simples.
- **Ações:**
  1. Em `src/types.ts` e `src/App.tsx`, expandir a paleta para os principais bancos brasileiros com nomes e classes Tailwind correspondentes:
     - **Santander / Bradesco:** Vermelho vibrante (`bg-red-600`)
     - **Nubank:** Roxo (`bg-purple-600`)
     - **Inter:** Laranja (`bg-orange-500`)
     - **Itaú:** Azul royal (`bg-blue-600`)
     - **Banco do Brasil:** Amarelo / Dourado (`bg-amber-400 text-zinc-900`)
     - **Caixa Econômica:** Azul marinho / Petróleo (`bg-sky-700`)
     - **C6 Bank:** Preto Carbon (`bg-zinc-900`)
     - **PicPay:** Verde Neon (`bg-emerald-500`)
     - **Mercado Pago:** Azul Ciano (`bg-cyan-600`)
     - **Neon:** Azul Turquesa (`bg-teal-500`)
     - **BTG Pactual:** Azul Noite (`bg-slate-800`)
     - **XP Investimentos:** Âmbar escuro (`bg-amber-600`)
     - **Sicredi:** Verde floresta (`bg-green-700`)
     - **Outros / Neutro:** Cinza grafite (`bg-zinc-700`)
  2. Implementar no formulário de criação e edição de contas (`Modal de Contas` em `src/App.tsx`) um seletor visual enriquecido com pré-visualização das cores e o nome do banco sugerido.

---

## 3. Lançamento Automático de Contrapartida em Transferências Entre Contas
- **Diagnóstico:** Quando o usuário registra uma saída na Conta A como Pix/Transferência para a Conta B, a Conta B não recebe automaticamente a entrada.
- **Preferência Confirmada:** Ambas as opções (detecção inteligente pelo nome da conta + seletor manual de conta destino no formulário) e lançamentos vinculados (excluir ou editar um atualiza/apaga o outro).
- **Ações:**
  1. **Tipagem (`src/types.ts`):** Adicionar campos opcionais em `Transaction`:
     - `transferTargetAccountId?: string;` (id da conta de destino/origem)
     - `transferLinkedId?: string;` (id da transação contrapartida vinculada)
     - `isTransferCounterpart?: boolean;`
  2. **Formulário (`src/components/TransactionForm.tsx`):**
     - Adicionar o campo opcional "Conta de Destino" quando o tipo for Despesa e a categoria for "Transferência", "Pix" ou quando o usuário selecionar a opção.
     - Suportar detecção inteligente: se o usuário digitar "Pix para Nubank" e existir uma conta chamada Nubank, sugerir automaticamente a conta de destino.
  3. **Execução no `src/App.tsx`:**
     - Ao adicionar a Despesa na Conta A, criar automaticamente a transação de Receita na Conta B:
       - Descrição: `Transferência de [Conta A]` (ou `Pix de [Conta A]`)
       - Categoria: `Transferência`
       - Conta: `Conta B`
       - Vínculo recíproco: `transferLinkedId` apontando uma para a outra.
     - Em `handleDeleteTransaction`: se a transação possuir `transferLinkedId`, remover simultaneamente a contrapartida (localmente e no Firestore).
     - Atualizar as regras do Firestore (`firestore.rules`) para validar os novos campos opcionais de transferência.

---

## 4. Otimização do Espaço do Card no Calendário Financeiro
- **Diagnóstico:** Em `src/components/ExpenseCalendar.tsx`, o card lateral de detalhes do dia selecionado (`ACTIVE DAY DETAILS`) impõe um limite artificial de altura de `max-h-[130px]` para a lista de transações, deixando a maior parte do card vazia ou mal aproveitada.
- **Ações:**
  1. Reestruturar o card lateral:
     - Compactar o cabeçalho de resumo do dia e a barra de calorias financeiras em um layout horizontal limpo.
     - Permitir que a lista de transações do dia se expanda para ocupar todo o espaço vertical disponível do card (`flex-1 min-h-[280px] max-h-[420px]`).
     - Aprimorar os cartões individuais de transação do dia com badges de categoria, conta bancária e valores com contraste e tipografia refinada.
     - Quando houver poucas transações ou nenhuma, exibir um estado visual proporcional e elegante preenchendo o card.

---

## 5. Régua Deslizante de Meses com Deslocamento em Bloco ao Atingir a Borda
- **Diagnóstico:** Na régua de meses (`src/App.tsx`), o container possui largura máxima limitada (`max-w-[280px]` a `max-w-[360px]`). Quando o usuário clica nas setas `<` e `>` para avançar além dos primeiros meses visíveis, os meses seguintes ficam cortados fora da área de visão.
- **Preferência Confirmada:** Deslocar a régua suavemente mantendo o mês ativo sempre visível e avançando o bloco para o lado.
- **Ações:**
  1. Adicionar uma `ref` ao container da lista de meses (`monthListRef`) e `ref` individual para os botões dos meses.
  2. Implementar efeito com `scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })` (ou cálculo de janela deslizante) acionado sempre que `currentMonth` mudar através das setas `<` e `>` ou clique direto.
  3. Garantir transição suave com Framer Motion no indicador de mês ativo e preservar os botões de ação ("Hoje" e o ano {currentYear}) firmemente alinhados.

---

## Plano de Verificação

### 1. Testes Automatizados & Estáticos
- Executar `lint_applet` (`tsc --noEmit`) para validar tipagens de `transferLinkedId`, novas cores e refs.
- Executar `compile_applet` (`vite build`) para assegurar que a compilação de produção passe sem erros.
- Se houver alteração em `firestore.rules`, acionar `deploy_firebase` e validar permissões.

### 2. Testes Manuais de Interface & Comportamento
- **Metas/Sonhos:** Abrir a aba Sonhos e certificar que a lista inicial está limpa, permitindo cadastrar novas metas sem reaparecimento dos exemplos mock.
- **Cores de Contas:** Abrir "Nova Conta" e editar conta existente, testando a seleção das novas cores bancárias (C6, Nubank, Inter, Itaú, BB, Caixa, etc.).
- **Transferência entre Contas:** Cadastrar um Pix de R$ 100 da Conta A para a Conta B. Verificar se a Conta B recebe a receita de R$ 100 e se apagar um lançamento apaga o outro automaticamente.
- **Calendário Financeiro:** Clicar em dias com múltiplos lançamentos e validar que a lista aproveita toda a altura e largura do card.
- **Régua de Meses:** Navegar de Janeiro até Dezembro pelas setas `>` e `<` em diferentes larguras de tela para verificar a rolagem e visualização do mês selecionado.

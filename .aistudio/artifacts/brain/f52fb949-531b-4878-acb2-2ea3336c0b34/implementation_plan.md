# Remoção Completa da Integração com MacroDroid e Notificações Bancárias

Plano estruturado para remover em definitivo do sistema toda a lógica, interface, endpoints de webhook, funções de parser e coleções no Firestore associadas ao aplicativo MacroDroid e ao fluxo de captura de notificações móveis.

---

### Decisões do Usuário & Confirmações

> [!IMPORTANT]
> - **Escopo Confirmado**: Remoção integral de todo o subsistema de captura e webhook (UI, parser, rotas do servidor Express e endpoints).
> - **Limpeza de Dados**: Desativação e exclusão das regras e estruturas das coleções de buffer de notificações (`incoming_notifications` e `pending_suggestions`), além da limpeza do armazenamento local (`localStorage`).
> - **Preservação**: O extrato de transações (`transactions`), as contas (`accounts`), os projetos (`projects`) e as metas orçamentárias (`budgetConfig`) permanecem 100% intactos e funcionais.

---

## 1. Visão Geral & Escopo da Remoção

O FintechCore possuía um fluxo experimental que conectava um aplicativo Android (MacroDroid) via webhook HTTP ou gravação direta no Firestore para capturar notificações de push bancárias (Pix, compras no cartão) e transformá-las em sugestões pendentes de aprovação.

A remoção eliminará:
1. **Componentes e Telas de UI**:
   - `MacroDroidModal.tsx`: modal com guia de configuração, passo a passo no Android e webhook URL.
   - `BankNotificationBanner.tsx`: banner fixo no topo do dashboard que exibia sugestões pendentes capturadas.
   - `AdjustSuggestionModal.tsx`: modal para editar descrição, parcelas e categoria da notificação antes de aprovar.
   - Botão e gatilho do MacroDroid no cabeçalho desktop (`App.tsx`) e no menu de ações mobile (`MobileHeaderMenu.tsx`).
2. **Servidor Backend (`server.ts`)**:
   - Rotas de webhook: `POST /api/webhook/bank-notification`, `GET /api/webhook/bank-notification`, `GET /api/webhook/status` e `GET /api/webhook/pending`.
   - Buffer em memória `pendingWebhookNotifications`.
3. **Bibliotecas e Tipos Frontend**:
   - `src/lib/notificationParser.ts`: parser regex de SMS e notificações bancárias.
   - Tipo `PendingSuggestion` em `src/types.ts`.
   - Listeners e funções de persistência de sugestões em `src/lib/dataSync.ts`.
4. **Segurança e Nuvem (Firestore)**:
   - Coleções `incoming_notifications` e `users/{userId}/pending_suggestions` em `firestore.rules` e `firebase-blueprint.json`.
   - Limpeza do cache local (`fintech_pending_suggestions`).

---

## 2. Experiência do Usuário (UX) Pós-Remoção

- **Interface Mais Leve e Limpa**:
  - O cabeçalho mobile (`MobileHeaderMenu`) perde o item "Captura Bancária (MacroDroid)", ficando focado exclusivamente em ações essenciais (Notificações, Áudio JARVIS, Modo Escuro e Exportação).
  - No desktop, o ícone de sincronização de notificações bancárias é removido do cabeçalho, deixando a barra superior despoluída.
  - O dashboard deixa de exibir o banner de sugestões pendentes, mantendo foco direto nos cartões de métricas consolidados e no extrato financeiro.
- **Fluxo de Lançamentos Preservado**:
  - Lançamento manual (Formulário rápido), importação de extrato bancário em PDF e lançamentos fixos recorrentes continuam funcionando perfeitamente.

---

## 3. Arquitetura e Limpeza Técnica

```
┌────────────────────────────────────────────────────────┐
│                      FintechCore                       │
├────────────────────────────────────────────────────────┤
│ REMOVIDO:                                              │
│  ✖ MacroDroidModal.tsx                                 │
│  ✖ BankNotificationBanner.tsx                          │
│  ✖ AdjustSuggestionModal.tsx                           │
│  ✖ notificationParser.ts                               │
│  ✖ server.ts: /api/webhook/*                           │
│  ✖ firestore.rules: incoming_notifications             │
│  ✖ firestore.rules: pending_suggestions                │
│                                                        │
│ MANTIDO:                                               │
│  ✔ Dashboard Financeiro (Métricas + Subpainéis)       │
│  ✔ Extrato & Lançamento de Transações (Manual e PDF)   │
│  ✔ Sincronização em Nuvem (Firebase Firestore + Auth)  │
│  ✔ Gerenciador de Contas, Cartões e Fundo Protegido    │
│  ✔ Assistente por Voz JARVIS & Inteligência Orçamentária│
└────────────────────────────────────────────────────────┘
```

### Detalhamento das Alterações:

1. **Remoção de Arquivos**:
   - `src/components/MacroDroidModal.tsx`
   - `src/components/BankNotificationBanner.tsx`
   - `src/components/AdjustSuggestionModal.tsx`
   - `src/lib/notificationParser.ts`
2. **Atualização em `src/components/MobileHeaderMenu.tsx`**:
   - Remover `onOpenMacroDroid` das props e da interface `MobileHeaderMenuProps`.
   - Remover o botão correspondente do menu dropdown.
3. **Atualização em `server.ts`**:
   - Remover as rotas `/api/webhook/*` e o array de notificações pendentes.
   - Manter `/api/health` e o middleware de dev do Vite intactos.
4. **Atualização em `src/lib/dataSync.ts`**:
   - Remover `subscribeToIncomingNotifications`, `savePendingSuggestionToFirestore`, `updatePendingSuggestionStatusInFirestore` e `deletePendingSuggestionFromFirestore`.
   - Remover `onPendingSuggestions` e o listener `unsubPendingSuggestions` em `subscribeToUserFinance`.
5. **Atualização em `src/types.ts`**:
   - Remover a interface `PendingSuggestion`.
6. **Atualização em `src/App.tsx`**:
   - Remover imports dos 3 componentes e do parser.
   - Remover estados `isMacroDroidModalOpen`, `pendingSuggestions` e `adjustingSuggestion`.
   - Remover polling `/api/webhook/pending` e listener `subscribeToIncomingNotifications`.
   - Remover handlers `handleApproveSuggestion`, `handleEditSuggestion` e `handleDismissSuggestion`.
   - Remover botão do MacroDroid no cabeçalho desktop e prop no `MobileHeaderMenu`.
   - Remover tags JSX `<MacroDroidModal>`, `<BankNotificationBanner>` e `<AdjustSuggestionModal>`.
   - Adicionar rotina única para limpar chave `'fintech_pending_suggestions'` do `localStorage`.
7. **Atualização em `firestore.rules` & `firebase-blueprint.json`**:
   - Remover regras e esquemas de `incoming_notifications` e `pending_suggestions`.
   - Re-implantar as regras atualizadas no Firebase via `deploy_firebase`.
8. **Verificação & Testes**:
   - Executar validação de tipos TypeScript (`tsc --noEmit`).
   - Compilar aplicação (`compile_applet`).
   - Verificar saúde do servidor (`/api/health`).

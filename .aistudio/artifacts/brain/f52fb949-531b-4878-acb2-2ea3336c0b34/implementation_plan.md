# Motor de Áudio JARVIS & Efeitos Sonoros Sci-Fi [CONCLUÍDO]

Implementação de um sistema completo de feedback por voz e efeitos sonoros inspirado no JARVIS da Marvel, integrando síntese de voz masculina personalizada em português, sintetizador Web Audio API para efeitos sonoros de alta tecnologia, controles de áudio na interface e sonorização de ações, navegação e notificações.

### Status da Implementação: Concluído e Ativo
- [x] Motor de som sci-fi procedual com Web Audio API (`src/lib/jarvisAudio.ts`)
- [x] Síntese vocal masculina calibrada com entonação JARVIS em português (`pt-BR`)
- [x] Componente de controle de áudio no topo da tela com popover, slider de volume e mudo (`src/components/AudioControls.tsx`)
- [x] Integração auditiva nas ações do sistema: lançamentos, faturas, exclusões, faturas importadas e notificações
- [x] Sonorização de transição entre abas (Dashboard, Extrato, Sonhos, Contas, Categorias, Gráficos)
- [x] Sonorização e anúncio vocal da sequência diária (Streak)
- [x] Validação de build e compilação sem erros

> [!IMPORTANT]
> As seguintes decisões foram confirmadas na fase de alinhamento e moldarão a arquitetura:
> - **Alcance do Feedback por Voz**: Em todas as ações principais, navegação entre abas e notificações emitidas pelo sistema.
> - **Estética Sonora**: Efeitos sonoros sutis de interface sci-fi e alta tecnologia sintetizados diretamente no navegador com a Web Audio API (sem dependência de arquivos externos que poderiam falhar ao carregar).
> - **Controle de Interface**: Botão integrado no cabeçalho com controle mestre de áudio (Mudo / Ativo), ajuste de volume e alternância independente entre Voz JARVIS e Efeitos Sonoros.

---

### 1. Overview & Core Concept

- **O que faz**: Adiciona uma presença auditiva sofisticada e futurista ao gerenciador financeiro. Sempre que o usuário adiciona transações, troca de abas, atinge metas ou recebe alertas, o sistema executa um feedback sonoro sci-fi imediato e uma síntese de voz com cadência britânica/elegante em português, referindo-se educadamente ao usuário como o JARVIS de Tony Stark.
- **Público-Alvo**: Usuários que buscam uma experiência de ponta, imersiva e produtiva em seu painel financeiro diário.
- **Principal Valor**: Transformar a rotina de registro financeiro em uma experiência dinâmica e envolvente, aumentando o engajamento e a percepção de controle tecnológico sobre o próprio orçamento.

---

### 2. User Experience & Visual Design

- **Controle no Topo do Aplicativo**:
  - Ícone de áudio/JARVIS localizado no cabeçalho ao lado do sino de notificações.
  - Indicador visual discreto: ondas sonoras holográficas sutis quando o JARVIS estiver falando ou quando houver som ativo.
  - Menu suspenso de áudio rápido:
    - Interruptor Geral: Mudo / Ativo.
    - Controle deslizante de Volume (0% a 100%).
    - Alternador "Voz do JARVIS (Fala)".
    - Alternador "Sons de Interface (Sci-Fi FX)".
    - Botão "Testar Voz do JARVIS" ("Olá, senhor. Todos os sistemas financeiros operando em capacidade nominal.").
- **Feedback em Ações do Sistema**:
  - **Criação de Transação**: Blip sci-fi de confirmação harmônico + voz: *"Transação registrada com sucesso, senhor."*
  - **Exclusão de Transação**: Som sci-fi de dissolução + voz: *"Item removido do registro."*
  - **Navegação de Abas**: Micro-pulso acústico de transição de dados + voz rápida contextual (*"Acessando extrato financeiro"*, *"Carregando gráficos e relatórios"*, etc.).
  - **Notificações & Alertas**: Som harmônico duplo sci-fi + voz narrando o alerta essencial.
  - **Metas & Sequência Diária**: Som celebratório de acordes sintéticos de alta fidelidade + voz: *"Sequência diária atualizada. Parabéns pela disciplina, senhor."*
- **Entonação da Voz**:
  - Seleção algorítmica de voz masculina em português (`pt-BR` ou `pt-PT`) com maior fidelidade disponível no sistema operacional do usuário.
  - Ajuste de parâmetros de fala: tom ligeiramente mais grave (`pitch: 0.90`) e cadência pausada e articulada (`rate: 0.98`), conferindo compostura, autoridade e calma.

---

### 3. Key Product Decisions & Trade-Offs

- **Decisão 1: Síntese de Efeitos Sonoros via Web Audio API (Osciladores & Filtros)**
  - *Abordagem Escolhida*: Geração procedural direta dos sons (senoides puras, filtros passa-faixa, curvas exponenciais de ganho e micro-arpeggios de frequências 800Hz–2400Hz).
  - *Por quê*: Latência zero (<5ms), sem consumo de banda de rede, sem risco de erro 404 de arquivos MP3 e garantia de consistência auditiva em qualquer plataforma.
  - *Alternativas Consideradas*: Arquivos de áudio estáticos externos (propensos a falhas de rede e bloqueios de CORS).
- **Decisão 2: Motor Híbrido com Web Speech API e Respeito a Autoplay**
  - *Abordagem Escolhida*: Síntese local no navegador via `window.speechSynthesis`, com ativação limpa vinculada ao primeiro clique do usuário para satisfazer os requisitos de áudio dos navegadores.
  - *Por quê*: Resposta instantânea sem custo de API por cada clique de navegação, funcionamento offline e privacidade total dos dados falados.
- **Decisão 3: Memória e Preferência Persistente**
  - *Abordagem Escolhida*: Armazenamento das configurações de volume, voz e mudo no `localStorage`, garantindo que o usuário tenha controle total e possa silenciar a qualquer instante se estiver em ambiente silencioso.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                      FINTECH CORE APP                           │
├───────────────────────────────┬─────────────────────────────────┤
│    Interface & Componentes    │        Sistema de Áudio         │
│                               │                                 │
│  [Top Header]                 │    ┌─────────────────────────┐  │
│    └── AudioControlsPopover ──┼───►│  jarvisAudioService     │  │
│                               │    ├─────────────────────────┤  │
│  [Tab Navigation]             │    │ • Web Audio FX Engine   │  │
│    └── Tab Change Handler ────┼───►│   (Blips, Sweeps, Alert)│  │
│                               │    │                         │  │
│  [Transaction Form & List]    │    │ • Voice Speech Engine   │  │
│    └── OnSave / OnDelete ─────┼───►│   (Pitch/Rate tuned,    │  │
│                               │    │    Portuguese Male)     │  │
│  [Notification Center]        │    │                         │  │
│    └── OnNewNotification ─────┼───►│ • Storage & Volume Bus  │  │
│                               │    └─────────────────────────┘  │
└───────────────────────────────┴─────────────────────────────────┘
```

#### Mapeamento de Eventos Sonoros:
1. `playSciFiSound('click')`: Micro-pulso 1200Hz com atenuação em 25ms.
2. `playSciFiSound('success')`: Tríade harmônica ascendente 523Hz -> 659Hz -> 784Hz.
3. `playSciFiSound('warning')`: Frequência dupla 320Hz/480Hz modulada.
4. `playSciFiSound('tab')`: Sweep de frequência 400Hz -> 800Hz em 60ms.
5. `speakJarvis(phrase, priority)`: Enfileiramento inteligente para evitar sobreposição caótica de falas, interrompendo ou complementando as mensagens com compostura.

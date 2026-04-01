# Cards Epic.gg - Documentacao Completa

Documentacao tecnica completa do projeto Cards Epic.gg, incluindo arquitetura, estrutura, rotas, modelos de dados, fluxos de negocio, operacoes administrativas e operacao local.

## 1. Visao Geral

Cards Epic.gg e uma aplicacao web de colecao de cartas em tema dark fantasy, com as seguintes funcionalidades principais:

- Autenticacao local (login, registro, logout)
- Abertura de pacotes com animacao e sorteio por raridade
- Colecao de cartas com inventario por instancias (mint e bonus roll)
- Loja de pacotes
- Fusao de cartas por tiers
- Batalhas por eventos semanais
- Painel admin para CRUD de cartas, pacotes e eventos
- Upload de imagens via Server Action

Arquitetura atual: frontend Next.js + persistencia local via localStorage + escrita de arquivos de imagem em public/uploads.

## 2. Stack Tecnica

- Framework: Next.js 16.2.1
- UI: React 19.2.4
- Linguagem: TypeScript 5 (strict)
- Lint: ESLint 9 + eslint-config-next
- Roteamento: App Router (pasta app)
- Estado global: React Context (AppProvider)
- Persistencia: localStorage (sem banco externo)
- Upload servidor: Server Action em Node fs/promises

## 3. Como Rodar Localmente

### Pre-requisitos

- Node.js 20+
- npm 10+

### Comandos

```bash
npm install
npm run dev
```

Aplicacao em: http://localhost:3000

### Credenciais admin seed

- Email: admin@epicgg.com
- Senha: admin123

## 4. Scripts do Projeto

Definidos em package.json:

- dev: next dev
- build: next build
- start: next start
- lint: eslint

## 5. Estrutura de Pastas e Arquivos

### Raiz

- package.json: metadados, scripts e dependencias
- tsconfig.json: configuracao TypeScript (strict true)
- eslint.config.mjs: configuracao ESLint para Next + TS
- next.config.ts: configuracao Next (padrao)
- README.md: esta documentacao

### app

- app/layout.tsx: layout raiz, metadata e AppProvider
- app/page.tsx: redireciona para /login ou /home conforme sessao
- app/globals.css: design tokens, utilitarios, reset e estilos globais

#### app/(auth)

- app/(auth)/login/page.tsx: login com email/senha
- app/(auth)/login/auth.module.css: estilo da tela de auth
- app/(auth)/register/page.tsx: cadastro de usuario com bonus inicial

#### app/(game)

- app/(game)/layout.tsx: gate de autenticacao + Navbar
- app/(game)/home/page.tsx: pagina de abertura de pacotes
- app/(game)/collection/page.tsx: colecao de cartas
- app/(game)/collection/collection.module.css: estilos da colecao
- app/(game)/packs/page.tsx: loja e abertura via redirecionamento
- app/(game)/packs/packs.module.css: estilos da loja
- app/(game)/fusion/page.tsx: sistema de fusao
- app/(game)/fusion/fusion.module.css: estilos da fusao
- app/(game)/battle/page.tsx: lobby de eventos de batalha
- app/(game)/battle/battle.module.css: estilos de batalha
- app/(game)/battle/[eventId]/page.tsx: detalhe da batalha por evento

#### app/admin

- app/admin/layout.tsx: gate admin
- app/admin/page.tsx: painel admin (tabs cards, packs, users, battles)
- app/admin/admin.module.css: estilos do admin

#### app/actions

- app/actions/upload.ts: Server Action para salvar imagens em disco

### components

- components/Card.tsx: card visual reutilizavel
- components/Card.module.css: estilos do card
- components/CardModal.tsx: modal detalhado de carta e instancias
- components/CardModal.module.css: estilos do modal
- components/Navbar.tsx: navegacao principal + saldo + logout
- components/Navbar.module.css: estilos da navbar
- components/PackOpener.tsx: experiencia completa de abertura
- components/Toast.tsx: container de notificacoes
- components/Toast.module.css: estilos de notificacao

### lib

- lib/types.ts: tipos centrais do dominio
- lib/db.ts: camada de persistencia localStorage + seed inicial
- lib/store.tsx: contexto global e regras de negocio
- lib/cardGenerator.ts: sorteio de raridade/cartas + mint/bonus
- lib/fusion.ts: tiers e regras de fusao
- lib/battle.ts: simulacao de batalha e eventos seed
- lib/audio.ts: efeitos sonoros (sintese + audio mp3)

### public

- public/audio: arquivos de audio opcionais
- public/uploads/cards: imagens de cartas enviadas no admin
- public/uploads/packs: imagens de pacotes enviadas no admin
- public/uploads/battles: imagens de eventos enviadas no admin

## 6. Rotas da Aplicacao

- /: redirect por sessao
- /login: autenticacao
- /register: cadastro
- /home: abrir pacotes
- /collection: visualizar colecao
- /packs: comprar/gerenciar pacotes
- /fusion: fundir cartas
- /battle: lobby de eventos
- /battle/[eventId]: arena do evento
- /admin: painel administrativo (somente admin)

Grupos de rota:

- (auth): organiza rotas publicas
- (game): organiza rotas protegidas do jogo

## 7. Modelo de Dados

Tipos definidos em lib/types.ts.

### Entidades principais

- User: conta, permissoes, moedas e historico
- Card: definicao base da carta
- UserCard: instancia individual da carta (mintId, bonusRoll, source)
- Pack: pacote vendavel/abrivel
- UserPack: inventario de pacote por usuario
- BattleEvent: evento jogavel com deck inimigo e regra especial
- DuelOutcome: resultado por slot

### Relacionamentos

- User 1:N UserCard
- UserCard N:1 Card
- User 1:N UserPack
- UserPack N:1 Pack
- BattleEvent referencia Card por ids em enemyCards

## 8. Persistencia e Seed

### localStorage

Chaves usadas:

- epicgg_users
- epicgg_cards
- epicgg_user_cards
- epicgg_packs
- epicgg_user_packs
- epicgg_current_user
- epicgg_seeded
- epicgg_battle_events
- epicgg_mint_counter

### Seed inicial

Executado em db.seed() na primeira carga:

- Cartas iniciais
- Pacotes iniciais
- Eventos de batalha seed
- Usuario admin
- Pacotes iniciais para admin

## 9. Regras de Negocio

### 9.1 Autenticacao

- Login valida email e senha
- Registro cria usuario e concede 3 pacotes p1
- Login diario concede +500 Epic Points
- Logout limpa usuario atual do estado

### 9.2 Abertura de Pacotes

- Consome 1 unidade de UserPack
- Sorteia entre cardsPerPack e cardsPerPack-1 (minimo 3)
- rollCards usa peso por raridade + dropWeight por carta
- Cada carta aberta vira UserCard (instancia unica)
- Bonus por milestones de abertura:
	- 5 pacotes: +1000 Epic Points
	- 10 pacotes: +2000 Epic Points

### 9.3 Loja de Pacotes

- Compra desconta epicPoints
- Adiciona 1 pack ao inventario
- Preco padrao: 1000 (ou priceEpicPoints do pack)

### 9.4 Fusao

Tiers em lib/fusion.ts:

- Common -> Uncommon (5 cartas, 100%)
- Uncommon -> Rare (3 cartas, 100%)
- Rare -> Epic (3 cartas, 90%)
- Epic -> Legendary (2 cartas, 80%)
- Legendary -> Mythic (2 cartas, 70%)
- Mythic -> Hero (2 cartas, 50%)

AFP:

- Cada AFP investido soma +2% de chance (cap 95%)
- Sucesso gera recompensa AFP por tier
- Falha concede AFP de consolacao

### 9.5 Batalha

- Batalha por slots contra deck inimigo do evento
- Poder base por raridade (1 a 7) + bonusRoll da instancia
- Regras especiais variam por eventId
- Resultado final: wins, losses, draws, tier
- Participacao semanal por evento e registrada em battleHistory
- Vitoria concede recompensas definidas em store.tsx

### 9.6 Admin

Tabs no painel:

- Cards: CRUD completo, upload e configuracao de drop
- Packs: CRUD completo e atribuicao para usuario
- Users: listagem e resumo de inventario
- Battles: CRUD de eventos, regra, reward e deck inimigo

Migracao local:

- Botao de migracao em admin para legado de cartas com quantity

## 10. Componentes e Responsabilidades

- Card: visual da carta, badges, raridade e quantidade
- CardModal: detalhes, lore, instancias e bonus
- Navbar: menu de navegacao e informacoes de saldo
- PackOpener: pipeline visual de abertura (idle->done)
- Toast: notificacoes disparadas por store

## 11. Arquitetura de Estado

Fonte principal: AppProvider em lib/store.tsx.

Estado global:

- currentUser
- allCards
- userCards
- allPacks
- userPacks
- allBattleEvents
- toasts

Acoes publicas do contexto:

- login, register, logout
- openPack, buyPack
- performFusion
- recordBattleResult, resetBattleParticipant
- refreshAll, refreshUserCards, refreshUserPacks, refreshBattleEvents
- addToast

## 12. Upload de Imagens

Fluxo:

1. Front comprime imagem (canvas/webp)
2. Envia base64 para uploadImageServerAction
3. Server salva em public/uploads/{tipo}
4. Retorna URL publica para uso no app

Tipos aceitos pela action:

- cards
- packs
- battles

## 13. Audio

lib/audio.ts contem:

- playEpicOpen: efeito sintetizado de abertura
- playHornOfGondor: efeito de destaque para carta nova
- playPackOpeningMusic: tenta mp3 custom e faz fallback

## 14. Seguranca e Limitacoes Atuais

Limitacoes da versao atual:

- Sem backend de autentificacao
- Senha armazenada em texto puro no localStorage
- Sem criptografia, token ou sessao server-side
- Dependencia de limite de localStorage do navegador
- Sem suite de testes automatizados

Riscos praticos:

- QuotaExceededError com crescimento de userCards
- Possivel manipulacao de dados no client via DevTools

## 15. Boas Praticas para Evolucao

Recomendacoes para proxima fase:

- Migrar persistencia para banco real (PostgreSQL/SQLite)
- Adotar autenticacao server-side com hash de senha
- Criar camadas de validacao de schema (ex: Zod)
- Introduzir testes (unitarios, integracao e E2E)
- Implementar observabilidade (logs e error tracking)

## 16. Troubleshooting

### A aplicacao nao abre no localhost

- Verifique Node e npm instalados
- Rode npm install
- Rode npm run dev
- Acesse http://localhost:3000

### Upload nao salva

- Verifique permissao de escrita no diretorio do projeto
- Confira se public/uploads e subpastas existem (a action cria se necessario)

### Dados inconsistentes no cliente

- Limpe localStorage do dominio local
- Reinicie a app para reexecutar seed

## 17. Estado Atual do Projeto

Status geral:

- Aplicacao funcional para fluxo completo de jogo local
- Painel admin funcional com CRUD e upload
- Estrutura preparada para evolucao para backend real

---

Fim da documentacao completa do projeto Cards Epic.gg.

# Karate Duel

Jogo de luta 1x1 com renderizacao `Three.js`, inspirado em kumite esportivo, construido com `Vite + React + TypeScript`.
O foco do projeto esta em um duelo arcade de karate com pontuacao por tecnicas, stamina, parry, combos, juiz em cena e IA adaptativa.

## Visao geral

O projeto roda como uma SPA simples: a rota principal renderiza o componente `KarateGame`, que monta a cena Three.js e mantem o HUD em overlay React.
Todo o loop de jogo e feito em `requestAnimationFrame`, enquanto a logica principal fica desacoplada em arquivos puros de dominio dentro de `src/game`.

Fluxo da aplicacao:

1. `src/pages/Index.tsx` renderiza o jogo.
2. `src/components/KarateGame.tsx` captura input, inicia a luta e executa o loop.
3. `src/game/engine.ts` atualiza estado, regras, IA, colisao, pontuacao e cerimonias.
4. `src/game/ThreeRenderer.ts` adapta o estado da engine para cena, camera, luzes, tatame, lutadores e efeitos 3D.
5. `src/game/types.ts` centraliza tipos e constantes do jogo.

## Stack e execucao

### Tecnologias

- `React 18`
- `TypeScript`
- `Vite 5`
- `Tailwind CSS`
- `Vitest`
- `Playwright` configurado no projeto, embora a validacao automatizada atual esteja concentrada em `Vitest`

### Scripts principais

- `npm run dev`: sobe o servidor de desenvolvimento em `http://localhost:8080`
- `npm run build`: gera a build de producao
- `npm run preview`: abre a build localmente
- `npm test`: executa os testes unitarios
- `npm run lint`: roda o ESLint

### Como rodar

```bash
npm install
npm run dev
```

O repositorio tambem possui `bun.lock` e `bun.lockb`, mas o fluxo atualmente testado no ambiente local foi com `npm`.

## Estrutura do projeto

```text
src/
  components/
    KarateGame.tsx       # loop, input de teclado, cena 3D e HUD overlay
  game/
    engine.ts            # regras, IA, stamina, score, hit detection, cerimonias
    ThreeRenderer.ts     # adaptador Three.js da cena e dos visuais
    types.ts             # tipos e constantes centrais
  pages/
    Index.tsx            # entrada da tela principal
  test/
    ai.test.ts           # heuristicas da IA
    scoring.test.ts      # pontuacao e vitoria automatica
```

## Funcionalidades do jogo

### Modo de jogo

- Duelo local contra IA
- Um jogador humano contra um oponente controlado por heuristicas
- Inicio pelo menu, com cerimonia de entrada antes do combate
- Interrupcao da luta apos ponto marcado
- Cerimonia de encerramento ao fim do tempo ou por diferenca de pontos

### Controles

- `Left/Right` ou `A/D`: mover
- `Z` ou `J`: `kizami-tsuki` (`punch`)
- `V` ou `N`: `gyaku-zuki`
- `X` ou `K`: chute alto (`kick`)
- `B` ou `M`: chute medio (`mae-geri`)
- `C` ou `L`: defesa
- `Enter` ou `Espaco`: iniciar partida ou reiniciar apos game over

### Estados da luta

O jogo alterna entre estes estados:

- `menu`
- `bow-in`
- `fighting`
- `point-scored`
- `bow-out`
- `game-over`

Esse fluxo torna a luta mais proxima de uma apresentacao de kumite:

1. Menu inicial
2. Reverencia inicial (`REI`)
3. Inicio da luta (`HAJIME!`)
4. Combate
5. Interrupcao com anuncio de ponto (`YAME!`)
6. Reverencia apos ponto e reinicio em posicoes fixas
7. Encerramento por tempo ou vantagem suficiente

## Regras implementadas

### Duracao e vitoria

- Tempo total de luta: `90` segundos
- Diferenca de `8` pontos encerra imediatamente a luta
- Se o tempo acabar:
  - maior pontuacao vence
  - empate gera `draw`

### Pontuacao

| Tecnica | Estado interno | Pontos | Chamada |
| --- | --- | ---: | --- |
| Kizami-tsuki | `punch` | 1 | `YUKO` |
| Gyaku-zuki | `gyaku-zuki` | 1 | `YUKO` |
| Chute medio | `mae-geri` | 2 | `WAZA-ARI` |
| Chute alto | `kick` | 3 | `IPPON` |

Regra adicional importante:

- qualquer golpe acertado em oponente abatido ou ainda em `hit-stun` vale `IPPON`

### Distancias e custo de stamina

| Tecnica | Alcance | Custo | Duracao base |
| --- | ---: | ---: | ---: |
| `punch` | `88` | `18` | `12` frames |
| `gyaku-zuki` | `82` | `24` | `14` frames |
| `mae-geri` | `100` | `26` | `16` frames |
| `kick` | `112` | `28` | `18` frames |

### Stamina

- Stamina maxima: `100`
- Recuperacao parado: `0.9` por frame
- Recuperacao recuando: `0.55` por frame
- Avancando, atacando e bloqueando: sem regeneracao
- Segurar defesa alem da janela de parry drena `0.35` por frame
- Se a stamina zera durante defesa, o lutador entra em estado de exaustao

### Hit, exaustao e travas

- `hit-stun`: `20` frames
- Exaustao: `60` frames sem agir
- O motor evita sobreposicao empurrando os personagens quando a distancia fica muito curta
- Os lutadores sempre se viram um para o outro automaticamente

## Mecanicas de combate

### Defesa, parry e contra-ataque

O sistema de defesa tem duas camadas:

- defesa comum: reduz impacto parcialmente, mas consome stamina
- parry perfeito: se o bloco entra na janela de `4` frames, o golpe e neutralizado e abre um contra-ataque

Detalhes do parry:

- janela de parry: `4` frames
- janela de contra-ataque apos parry: `25` frames
- recompensa de stamina no parry: `+15`
- o atacante fica atordoado por curto periodo
- o jogo troca a animacao defensiva conforme a altura do golpe:
  - `uchi-uke` para golpes altos
  - `gedan-barai` para golpes baixos/medios

### Telegraph

Antes do hit-frame, ataques geram um aviso visual curto:

- `ATTACK_STARTUP_TELEGRAPH = 5` frames
- isso permite leitura do golpe e cria espaco para defesa ou recuo

### Avanco explosivo

Cada tecnica aplica um lunge curto no inicio da animacao:

- aproxima o lutador do alvo
- melhora leitura visual do golpe
- evita teleporte, porque existe um limite maximo de distancia por investida

### Combos e cancel

O jogo tem sistema de encadeamento:

- janela de combo apos acerto: `25` frames
- custo reduzido em combo: `20%`
- duracao reduzida em combo: `30%`
- janela de cancel no fim do golpe: `6` frames
- input buffer: `12` frames

Na pratica, isso permite sequencias mais fluidas, inclusive pre-input durante a recuperacao do golpe anterior.

## IA do oponente

A IA nao usa arvore de comportamento complexa, mas tem heuristicas suficientes para gerar ritmos diferentes de luta.

### Modos taticos

A IA alterna entre:

- `pressure`: pressiona quando esta atras no placar, quando o tempo aperta ou quando percebe o jogador desgastado
- `bait`: segura distancia e tenta induzir erro
- `evasive`: recua quando esta vencendo, quando esta com pouca stamina ou quando detecta telegraph perigoso
- `punish`: responde a parry bem-sucedido e a golpes errados fora de distancia

### Comportamentos observados

- avanca e recua com base na distancia
- tenta bloquear ou sair da linha quando le o startup do jogador
- pune whiff recovery
- planeja combos em certas aberturas
- respeita gasto de stamina
- aumenta a agressividade conforme a dificuldade sobe

### Dificuldade dinamica

- dificuldade inicial: `0.3`
- quando o jogador marca ponto, a dificuldade sobe em `0.1`
- limite superior: `0.9`

Isso cria um ajuste dinamico simples: quanto mais o jogador pontua, mais perigosa a IA tende a ficar.

## Renderizacao e apresentacao

O estado da luta continua na engine, enquanto o visual principal e adaptado para uma cena Three.js.

Principais elementos renderizados:

- dojo com fundo estilizado
- iluminacao e camera 2.5D
- tatame WKF procedural
- placeholders ou modelos 3D dos lutadores
- HUD React com placar `AKA` vs `AO`
- barra de stamina para ambos
- cronometro
- mensagens centrais do arbitro
- hit effects com texto de impacto
- tela de menu
- tela de fim de jogo

O renderer privilegia:

- leitura clara do estado da luta
- feedback visual de ataque, parry e stamina
- leitura espacial clara para luta 2.5D

## Arquitetura tecnica

### Pontos fortes

- Separacao boa entre input/loop (`KarateGame`), regra (`engine`) e adaptador visual (`ThreeRenderer`)
- Regras principais modeladas em funcoes puras ou quase puras, o que facilita teste
- Constantes do jogo centralizadas em `types.ts`
- Testes cobrindo partes criticas de pontuacao e heuristicas da IA
- Jogo inteiro funciona sem backend

### Pontos de atencao

- O estado do jogo e mutado in-place em `engine.ts`, o que funciona para o prototipo arcade, mas dificulta evolucao para replay, rollback ou sincronizacao online
- A IA usa estado global de modulo (`aiAction`, `aiActionTimer`, `aiComboNext`), o que acopla a simulacao a uma unica luta por vez
- O input buffer tambem e global ao modulo, o que reduz reusabilidade do motor
- A cobertura automatizada atual nao cobre renderizacao, input de teclado nem fluxo completo de partida
- O projeto ainda carrega bastante infraestrutura de template React/shadcn que nao participa diretamente do jogo
- Ha alguns comentarios/textos com artefatos de encoding nos arquivos do jogo, sem quebrar a execucao, mas afetando legibilidade do codigo

## Testes existentes

Arquivos relevantes:

- `src/test/scoring.test.ts`
- `src/test/ai.test.ts`
- `src/test/example.test.ts`

Cobertura atual:

- atribuicao correta de `YUKO`, `WAZA-ARI` e `IPPON`
- `IPPON` automatico em oponente abatido
- vitoria automatica por diferenca de `8` pontos
- identificacao de whiff punish
- selecao de modo tatico da IA em cenarios de pressao, evasao e punicao

## Validacao executada

Validado localmente neste estado do repositorio:

- `npm test`: `9` testes passando
- `npm run build`: build de producao gerada com sucesso

Observacao:

- a build exibiu apenas um aviso de `Browserslist` desatualizado, sem impedir a geracao dos assets

## Melhorias sugeridas

- Adicionar testes de fluxo completo para `updateGame`
- Extrair o estado global da IA para dentro de `GameState`
- Permitir configuracao de dificuldade no menu
- Adicionar efeitos sonoros e musica
- Incluir pausa e remapeamento de teclas
- Exibir tutorial visual durante o menu inicial
- Reduzir dependencias de UI nao utilizadas se o objetivo do repositorio for manter foco no jogo

## Resumo

`Karate Duel` e um projeto de jogo arcade bem organizado para prototipacao rapida: a base de combate esta funcional, a IA responde a contexto, a pontuacao segue um conjunto coerente de regras e a separacao entre motor e adaptador visual e suficiente para evolucao local.

Ao mesmo tempo, ainda e um projeto de escopo pequeno, com espaco claro para amadurecer em tres frentes: testes de integracao, isolamento do estado do motor e limpeza da infraestrutura herdada do template front-end.

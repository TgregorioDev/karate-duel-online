# Karate Duel

> Projeto em desenvolvimento: mecanicas, animacoes, balanceamento, assets 3D e apresentacao visual ainda estao em evolucao.

`Karate Duel` e um jogo de luta 1x1 inspirado em kumite esportivo WKF, construido com `Vite`, `React`, `TypeScript` e `Three.js`. O projeto combina uma engine de estado em TypeScript com renderizacao 3D, HUD React, modelos GLB para AKA/AO, placar de arena e regras arcade baseadas em pontuacao de karate competitivo.

## Estado Atual

- Renderizacao migrada para `Three.js` com cena 2.5D, camera lateral, luzes, sombras e tatame procedural WKF.
- Lutadores AKA e AO usam modelos GLB reais com `AnimationMixer`; capsulas ficam apenas como fallback de carregamento.
- Assets 3D seguem pipeline master/slave: `reference.glb` contem malha e esqueleto, enquanto os demais GLBs fornecem clips de animacao.
- Arbitro 3D esta desabilitado temporariamente; a arbitragem aparece por mensagens transientes, placar e estado da luta.
- Projeto pronto para empacotamento HTML5 no itch.io com paths relativos.

## Como Rodar

```bash
npm install
npm run dev
```

Scripts principais:

- `npm run dev`: inicia o Vite em `http://localhost:8080`.
- `npm run build`: gera a build de producao em `dist/`.
- `npm run preview`: serve a build localmente.
- `npm test`: executa a suite Vitest.
- `npm run lint`: roda ESLint. Atualmente ainda pode apontar problemas herdados dos componentes base/shadcn.

## Estrutura

```text
src/
  components/
    KarateGame.tsx              # host React, loop, HUD, modais e ciclo de vida Three.js
    game-ui/                    # intro, pausa, resultado e lista de movimentos
  game/
    engine.ts                   # regras, estados, pontuacao, IA, stamina, colisao e cerimonias
    ThreeRenderer.ts            # cena Three.js, assets GLB, tatame, camera, placar e efeitos
    InputManager.ts             # teclado P1/P2 e prevencao de ghost input
    akaAnimationUtils.ts        # selecao de clips, retarget/facing helpers
    types.ts                    # tipos e constantes centrais
  test/
    scoring.test.ts             # pontuacao, hit zones, defesa e reset
    ai.test.ts                  # perfis e leitura tatica da IA
    stamina.test.ts             # custos, regeneracao e fadiga
    inputManager.test.ts        # inputs independentes P1/P2
public/
  models/fighters/aka/animations/
  models/fighters/ao/animations/
```

## Modos de Jogo

- `Player vs IA`: AKA e controlado pelo jogador; AO usa a IA estrategica.
- `1 vs 1 Local`: AKA e AO respondem a teclas independentes no mesmo teclado.
- Perfis de IA: `Kyu`, `Dan` e `Sensei`, com diferencas de reacao, bloqueio, agressividade, combos e antecipacao.

## Controles

Player 1 - AKA:

- `A / D`: mover
- `Z`: kizami-zuki
- `V`: gyaku-zuki
- `X`: mawashi-geri
- `B`: mae-geri
- `C`: guarda/defesa

Player 2 - AO:

- `Seta esquerda / direita`: mover
- `I`: kizami-zuki
- `O`: gyaku-zuki
- `P`: mawashi-geri
- `K`: mae-geri
- `L`: guarda/defesa

Globais:

- `Enter` ou `Espaco`: iniciar/reiniciar
- `ESC`: pausar

## Fluxo da Luta

Estados principais:

- `menu`
- `bow-in`
- `fighting`
- `point-scored`
- `bow-out`
- `game-over`

O jogo inicia no menu, executa reverencia (`REI`), chama `HAJIME`, entra em combate, interrompe imediatamente quando ha ponto (`YAME`) e reseta os lutadores para as linhas oficiais antes de retomar.

## Regras de Pontuacao

| Tecnica | Alvo | Pontos | Chamada |
| --- | --- | ---: | --- |
| Kizami-zuki | Jodan ou Chudan | 1 | `YUKO` |
| Gyaku-zuki | Jodan ou Chudan | 1 | `YUKO` |
| Mae-geri | Chudan | 2 | `WAZA-ARI` |
| Mawashi-geri | Chudan | 2 | `WAZA-ARI` |
| Mawashi-geri | Jodan | 3 | `IPPON` |

As hitboxes logicas segmentam `head_target` e `body_target`. O golpe so pontua quando o atacante esta virado para o defensor, dentro da distancia correta e na janela ativa da animacao.

## Stamina e Fadiga

Barra base: `100` unidades.

| Acao | Custo |
| --- | ---: |
| Kizami-zuki | 10 |
| Gyaku-zuki | 15 |
| Mae-geri | 25 |
| Mawashi-geri | 40 |
| Guarda ativa | 5/s |
| Movimentacao | 2/s |

Regras atuais:

- Golpes com custo maior que `15` atrasam a recuperacao por `1.5s`.
- A recuperacao volta a `15` unidades por segundo apos o delay.
- Se a stamina chega a `0`, o lutador entra em fadiga por `2s`.
- Durante fadiga, o lutador nao ataca e move com velocidade reduzida em `40%`.
- A barra pisca quando o jogador tenta atacar sem stamina suficiente.

## Defesa

O sistema de parry perfeito foi simplificado temporariamente para favorecer responsividade:

- Enquanto o botao de defesa esta segurado, golpes recebidos podem ser defendidos.
- Golpes jodan disparam `uchi-uke`.
- Golpes chudan disparam `gedan-barai`.
- Defesas nao geram modal de arbitragem; o feedback e visual pela animacao e pelo bloqueio do ponto.
- A ideia de parry mais preciso pode voltar depois, com uma janela menos punitiva.

## Combate e Movimento

- Golpes possuem lunge/avanco explosivo no eixo X.
- Kizami-zuki e mawashi-geri receberam alcance/avanco maior para manter dinamismo.
- Combos permitem cancelamento no fim de golpes e transicoes rapidas, como `Z -> V`.
- O motor usa input buffer para aceitar pre-input sem criar ghost input.
- A colisao foi ajustada para preservar a animacao, evitando pontuar cedo demais antes do impacto visual.
- AKA e AO atualizam facing continuamente para ficarem frente a frente, mesmo trocando de lado.

## IA do AO

A IA avalia:

- distancia (`tohma`, `maai`, `chika-ma`)
- stamina propria
- estado e startup do AKA
- repeticao de golpes do jogador
- oportunidades de punicao por whiff
- perfil selecionado (`Kyu`, `Dan`, `Sensei`)

Comportamentos:

- recua quando esta com pouca stamina
- bloqueia ou responde a ataques detectados
- tenta sen-no-sen contra golpes pesados
- usa combos basicos em perfis avancados
- aumenta a chance de contra-ataque quando o jogador repete o mesmo golpe

## Cena e UI

- Tatame WKF procedural com area central azul, bordas vermelhas e marcas iniciais.
- Lutadores iniciam em `x = -1.5m` e `x = 1.5m`.
- Placar fisico no fundo mostra tempo e pontuacao de AKA/AO.
- HUD superior exibe apenas stamina/energia dos lutadores.
- Mensagens de arbitragem aparecem de forma transiente acima da area de combate.
- Modais de intro, pausa, resultado e lista de movimentos sao componentes React separados.

## Assets 3D

Organizacao atual:

```text
public/models/fighters/
  aka/animations/
    reference.glb
    stance.glb
    walk.glb
    kizame.glb
    gyaku.glb
    mae-geri.glb
    mawashi-geri.glb
    uchi-uke.glb
    gedan-barai.glb
  ao/animations/
    reference.glb
    ...
```

Notas tecnicas:

- `reference.glb` e a fonte unica de mesh e esqueleto.
- Os demais arquivos sao carregados para extrair apenas o primeiro `AnimationClip`.
- O renderer limpa geometrias/materiais temporarios apos extracao para reduzir memoria.
- As tracks passam por normalizacao de nomes de ossos para funcionar com exports Mixamo/Blender.

## Publicacao no itch.io

O projeto ja usa paths relativos para funcionar em iframe/subpasta do itch.io.

Para gerar um pacote:

```powershell
npm run build
Compress-Archive -Path dist\* -DestinationPath releases\karate-duel-itch.zip -CompressionLevel NoCompression -Force
```

Arquivo preparado localmente:

```text
C:\Users\grego\karate-duel-online\releases\karate-duel-itch.zip
```

No itch.io:

1. Criar/editar o jogo.
2. Selecionar `Kind of Game: HTML Game`.
3. Fazer upload de `karate-duel-itch.zip`.
4. Marcar o arquivo como jogavel no navegador.
5. Preferir `Click to launch in fullscreen`, pois o jogo usa teclado.

## Testes

Comandos recomendados:

```bash
npm test
npm run build
```

Ultima validacao local:

- `npm test`: 45 testes passando.
- `npm run build`: build gerada com sucesso.
- `npm run lint`: ainda falha por problemas herdados em componentes base e `tailwind.config.ts`; a engine de jogo nao apresentou os erros recentes de lint apos os ultimos ajustes.

## Roadmap Sugerido

- Revisitar o sistema de parry com janela mais humana e feedback claro.
- Otimizar os `reference.glb` principais para reduzir tempo de carregamento.
- Adicionar sons de impacto, kiai, placar e ambiente.
- Adicionar configuracao de dificuldade e remapeamento de teclas.
- Migrar estado global da IA para dentro de `GameState` se houver planos de replay, rollback ou multiplayer online.
- Aumentar cobertura de smoke tests visuais com navegador.

## Licenca

Este repositorio ainda nao declara uma licenca formal.

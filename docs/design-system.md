# Design System

## Palette

- Background: `#1D161F`
- Purple: `#533D64`
- Orange: `#DB633A`
- Gold: `#D4A047`
- Cream: `#FFECA5`
- Soft cream: `#FFFBEA`
- Green: positive terminal states only

Os valores ficam centralizados em `resources/css/assets.css`. Componentes devem
consumir os tokens `--asset-*` ou os tokens semanticos do tema; novas cores nao
devem ser repetidas diretamente nas telas.

## UI

Rechi OS usa janelas com titlebar roxa, botoes de minimizar/maximizar/fechar, dock lateral, textura discreta, brilho laranja perto do piso e pixel art feita com componentes reais.

Minimizar esconde a janela mantendo-a disponivel no dock. Fechar remove a janela
do desktop; selecionar o aplicativo no dock abre a janela novamente. Maximizar
alterna entre a area util inteira e o tamanho anterior.

No mobile, apps viram paineis empilhados em vez de tentar comprimir o desktop.

## Brand mark

A identidade usa os assets oficiais `Logo.svg` e `Icon.svg`. O wordmark completo
identifica as telas de autenticacao; o icone compacto identifica o dashboard e
o favicon.

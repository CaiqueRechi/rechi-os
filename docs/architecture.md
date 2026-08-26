# Architecture

Rechi OS usa Laravel 13 com o starter oficial React. Em agosto de 2026 o starter oficial gerou Inertia Laravel/React 3, embora o briefing pedisse Inertia 2. A decisao foi preservar o starter oficial atual para evitar downgrade e dependencias incompatíveis.

## Camadas

- React/Inertia: desktop visual, janelas, terminal seguro, contato e Ask Rechi.
- Controllers: entrada HTTP para home, API v1, contato, admin e assistente.
- Services: regras de negocio pequenas e testaveis (`PublicPortfolioRepository`, `PortfolioCacheService`, `ContactMessageService`, `PortfolioAssistantService`).
- Models: dados estruturados do portfolio, conversas, mensagens e auditoria.
- Redis: cache publico, rate limiting, sessoes e filas.

## Dados

O conteudo publico vem do banco: perfil, projetos, experiencias, categorias de skills e redes sociais. Projetos guardam listas estruturadas em JSON para responsabilidades, decisoes tecnicas, arquitetura, resultados e metricas.

## Admin

O admin fica em `/admin`, exige login verificado e Gate `managePortfolio`. Registro publico foi removido do Fortify. O primeiro admin pode ser criado por seeder com envs seguras ou pelo comando `portfolio:create-admin`.

## Assistente

React nunca chama OpenAI diretamente. O backend usa `AiGateway`, `OpenAiResponsesGateway`, `PortfolioAssistantService` e modelos de conversa. Sem `OPENAI_API_KEY`, o sistema responde com fallback publico. Ferramentas internas sao somente leitura e descritas por schemas estritos.

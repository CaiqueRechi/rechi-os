# AI Integration

Ask Rechi usa OpenAI Responses API no backend por meio de `AiGateway`.

## Rules

- O modelo vem de `OPENAI_MODEL`.
- React nunca recebe `OPENAI_API_KEY`.
- Ferramentas internas sao somente leitura: `get_profile`, `list_projects`, `get_project`, `list_experiences`, `list_skills`, `get_contact_options`.
- Argumentos devem ser validados e schemas rejeitam propriedades extras.
- Respostas sao sanitizadas antes de persistir e renderizar.
- Testes devem usar mock de `AiGateway` e nunca consumir creditos reais.

## Failure Mode

Sem chave ou indisponibilidade externa, o assistente responde com fallback baseado nos dados publicos do portfolio.

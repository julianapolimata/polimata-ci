# Polímata_Sistema Operacional/

Documentação interna, mockups e scripts SQL relacionados ao Sistema Operacional Polímata (este repo).

Conteúdo:
- `Roteiro_Teste_*.docx`, `Checklist_Testes_Validacao.docx`, `Roteiro_Teste_v2.md` — roteiros e checklists de QA
- `mockup-*.html` — mockups de redesigns e workflows
- `preview-email-*.html` — previews de templates de email (admin e usuário)
- `SQL_*.sql` — scripts SQL de migração já aplicados (referência histórica)

Esta pasta é **documentação e referência** — nada aqui é importado pelo código de produção.

> **Nota técnica:** o nome da pasta contém acento e espaço, o que pode causar problemas em CI/CD em alguns ambientes. Por ora, mantém-se assim pois nenhum import depende dela e migrar exigiria atualizar links em documentação espalhada.

# ADR 005 — Plataforma Exclusivamente em Português Brasileiro

**Status:** Aceito  
**Data:** 2025-05-19

## Contexto

O Facilita PrEP atende exclusivamente pacientes e profissionais de saúde no Brasil. Toda a interface, comunicações (e-mail, WhatsApp), documentos clínicos e relatórios são em Português Brasileiro (pt-BR).

## Decisão

A plataforma é **intencionalmente monolíngue em pt-BR**. Não há i18n framework, arquivos de tradução, ou suporte a outros idiomas.

## Justificativa

1. **Escopo de negócio:** 100% dos usuários são brasileiros; clínica, pacientes e equipe médica operam em pt-BR
2. **Documentos regulatórios:** CFM 2.299/2021 e LGPD exigem documentação em português; prescrições digitais e TCLE têm valor legal apenas em pt-BR
3. **Custo-benefício:** i18n framework (react-i18next, etc.) adiciona complexidade de build, manutenção e revisão de traduções sem nenhum benefício atual
4. **Dados de saúde:** Terminologia médica brasileira (CID-10, TUSS, terminologia SUS) não tem mapeamento direto em outros idiomas

## Consequências

**Prós:**

- Código mais simples: strings inline, sem chaves de tradução, sem `t()` wrappers
- Menos surface area para erros de tradução em contexto médico crítico
- Builds mais rápidos e bundle menor

**Contras:**

- Se a clínica expandir internacionalmente, i18n precisará ser retrofitted — custo maior que adicionar desde o início

## Alternativas Consideradas

- **react-i18next desde o início:** descartado — overhead sem uso real, e strings de saúde em pt-BR têm nuances legais que precisam de revisão médica, não apenas tradução
- **Inglês como língua base + pt-BR via tradução:** inadequado para plataforma de saúde brasileira sujeita a regulação local

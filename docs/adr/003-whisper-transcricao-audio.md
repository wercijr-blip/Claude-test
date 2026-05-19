# ADR 003 — Transcrição de Áudio via OpenAI Whisper

**Data:** 2026-05-19
**Status:** Aceito

---

## Contexto

O CIS captura consultas médicas em áudio (upload via S3 presigned URL) e precisa converter o áudio em texto para alimentar os prompts de geração de SOAP note (CIS-02a/02b). A qualidade da transcrição afeta diretamente a qualidade das notas clínicas geradas.

Critérios para a escolha do provedor de transcrição:

1. **Qualidade em português médico:** terminologia clínica (CID-10, nomes de patógenos, fármacos) deve ser transcrita com alta fidelidade.
2. **Latência aceitável:** consultas de 15–30 minutos precisam ser transcritas em < 3 minutos para não bloquear o fluxo de atendimento.
3. **Custo por minuto de áudio:** deve ser viável para 20–40 consultas/dia.
4. **Chunking para arquivos grandes:** arquivos de áudio longos (> 25 MB) devem ser processados sem erros de limite de tamanho.

Alternativas consideradas:

1. **AWS Transcribe Medical:** suporte a terminologia médica em inglês. Rejeitado — sem suporte a português médico na versão Medical; latência alta para arquivos longos.
2. **Google Speech-to-Text Medical:** suporte a português. Rejeitado — custo por minuto superior ao Whisper; integração mais complexa.
3. **AssemblyAI:** suporte a português e summarization nativa. Rejeitado — custo mensal fixo alto para volume atual; dependência adicional.
4. **OpenAI Whisper API (`gpt-4o-mini-transcribe`):** modelo multilingual de alta qualidade, baixo custo, API simples. **Escolhido.**

---

## Decisão

Usar **OpenAI Whisper (`gpt-4o-mini-transcribe`)** para transcrição de áudio de consultas, com implementação de **chunking automático** para arquivos acima do limite de 25 MB da API.

**Funcionamento:**

- O médico faz upload do áudio diretamente para S3 via presigned URL (sem passar pelo servidor CIS).
- `scriba.transcreverAudio` baixa o arquivo do S3, verifica o MIME type e inicia a transcrição.
- Para arquivos > 20 MB, `transcribeWithChunking` divide o áudio em segmentos de 10 minutos com 5 segundos de overlap para evitar corte de palavras, transcreve cada segmento em paralelo e concatena os resultados.
- O prompt do Whisper inclui o contexto de linguagem médica em português para melhorar a acurácia de terminologia clínica.
- A transcrição resultante é passada diretamente para CIS-02a (geração de SOAP note via Sonnet).

**Limites e tratamento de erros:**

- Áudios com menos de 1 segundo são rejeitados com erro `BAD_REQUEST`.
- MIME types não-áudio são rejeitados antes do upload.
- Falhas na API OpenAI retornam `INTERNAL_SERVER_ERROR` com mensagem amigável.
- O arquivo S3 não é deletado após a transcrição — retenção gerenciada por lifecycle policy.

---

## Consequências

### Positivas

- **Qualidade superior em português:** Whisper foi treinado em dados multilinguais e tem excelente desempenho em terminologia médica brasileira.
- **Custo previsível:** `gpt-4o-mini-transcribe` tem custo fixo por minuto de áudio, sem surpresas por volume de tokens.
- **Integração simples:** OpenAI SDK já presente como dependência indireta; adiciona apenas uma chamada de API.
- **Chunking robusto:** consultas longas (> 60 min) são tratadas sem erros de limite, com qualidade preservada pelo overlap entre chunks.

### Negativas

- **Dependência do provedor OpenAI:** qualquer indisponibilidade da API impede a geração de SOAP notes para aquela consulta. Mitigação: a consulta pode ser re-transcrita posteriormente — o áudio permanece no S3.
- **Custo adicional por provedor:** o CIS usa Anthropic para LLM e OpenAI apenas para Whisper — dois provedores de IA. Alternativa futura: usar Whisper self-hosted em Railway se o volume justificar.
- **Privacidade de áudio médico:** o áudio da consulta é enviado para servidores OpenAI para transcrição. Mitigação documentada: os dados são processados sob os termos de uso da API OpenAI (zero data retention para API customers); o nome do paciente nos dados enviados é apenas o áudio, não identificado com o cadastro CIS.
- **Sem retry automático:** falhas transitórias na API Whisper não têm retry implementado. A ser endereçado em versão futura com a fila de re-processamento.

**Decisão de revisão:** Reavaliar se o volume de áudio superar 10.000 minutos/mês ou se surgir alternativa self-hosted com qualidade equivalente.

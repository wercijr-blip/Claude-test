/**
 * OpenAPI 3.0 spec for Facilita PrEP.
 *
 * Covers all REST endpoints exposed directly by Express.
 * tRPC procedures (/trpc/*) are documented as a JSON-RPC reference section —
 * they do not map to individual OpenAPI paths.
 *
 * Served at GET /api/docs (Swagger UI) and GET /api/docs/openapi.json.
 */
export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Facilita PrEP API',
    version: '1.0.0',
    description:
      'Plataforma de saúde digital brasileira para prevenção do HIV via PrEP (Profilaxia Pré-Exposição).\n\n' +
      '## Autenticação\n\n' +
      'Endpoints de operação (`/api/metrics`, `/api/health/queues`, `/api/health/observability`, `/api/admin/usage`) ' +
      'exigem o header **`x-ops-token`** com o valor configurado em `OPS_TOKEN`.\n\n' +
      'Endpoints tRPC (`/trpc/*`) usam sessão JWT via cookie `session`. ' +
      'Consulte a seção **tRPC** no final deste documento.\n\n' +
      '## Conformidade\n\n' +
      'SBIS Nível INTERMEDIÁRIO (BPIA + ECF + NGS1 + NGS2) · LGPD · CFM 2.299/2021',
    contact: {
      name: 'Facilita PrEP',
      url: 'https://facilitaprep.com.br',
    },
    license: {
      name: 'Proprietário',
      url: 'https://facilitaprep.com.br/termos',
    },
  },
  servers: [
    { url: '/api', description: 'Servidor atual' },
    { url: 'https://facilitaprep.com.br/api', description: 'Produção' },
  ],
  tags: [
    { name: 'Health', description: 'Verificações de saúde do sistema' },
    { name: 'Operações', description: 'Métricas e status operacional (requer x-ops-token)' },
    { name: 'Upload', description: 'Upload de exames' },
    { name: 'Webhooks', description: 'Integrações externas (Asaas)' },
    { name: 'tRPC', description: 'Endpoints tRPC — chamados via JSON-RPC em /trpc/*' },
  ],
  components: {
    securitySchemes: {
      opsToken: {
        type: 'apiKey',
        in: 'header',
        name: 'x-ops-token',
        description: 'Token de operações definido pela variável de ambiente `OPS_TOKEN`',
      },
    },
    schemas: {
      HealthBasic: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok', 'degraded'], example: 'ok' },
          uptime: { type: 'integer', description: 'Uptime em segundos', example: 3600 },
          version: { type: 'string', example: '1.0.0' },
          db: { type: 'string', enum: ['ok', 'error'], example: 'ok' },
          redis: { type: 'string', enum: ['ok', 'error'], example: 'ok' },
          timestamp: { type: 'string', format: 'date-time' },
        },
        required: ['status', 'uptime', 'version', 'db', 'redis', 'timestamp'],
      },
      HealthDeep: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok', 'degraded'] },
          checks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'db' },
                ok: { type: 'boolean' },
                error: { type: 'string', description: 'Presente apenas quando ok=false' },
              },
              required: ['name', 'ok'],
            },
          },
          timestamp: { type: 'string', format: 'date-time' },
        },
        required: ['status', 'checks', 'timestamp'],
      },
      QueueStats: {
        type: 'object',
        properties: {
          waiting: { type: 'integer', example: 0 },
          active: { type: 'integer', example: 1 },
          delayed: { type: 'integer', example: 0 },
          failed: { type: 'integer', example: 0 },
          completed: { type: 'integer', example: 42 },
        },
        required: ['waiting', 'active', 'delayed', 'failed', 'completed'],
      },
      QueueError: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Connection refused' },
        },
        required: ['error'],
      },
      HealthQueues: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok', 'degraded'] },
          queues: {
            type: 'object',
            properties: {
              pdf: { oneOf: [{ $ref: '#/components/schemas/QueueStats' }, { $ref: '#/components/schemas/QueueError' }] },
              linkAcesso: { oneOf: [{ $ref: '#/components/schemas/QueueStats' }, { $ref: '#/components/schemas/QueueError' }] },
              pesquisa: { oneOf: [{ $ref: '#/components/schemas/QueueStats' }, { $ref: '#/components/schemas/QueueError' }] },
              lembrete: { oneOf: [{ $ref: '#/components/schemas/QueueStats' }, { $ref: '#/components/schemas/QueueError' }] },
              nutricao: { oneOf: [{ $ref: '#/components/schemas/QueueStats' }, { $ref: '#/components/schemas/QueueError' }] },
              exam: { oneOf: [{ $ref: '#/components/schemas/QueueStats' }, { $ref: '#/components/schemas/QueueError' }] },
            },
          },
          timestamp: { type: 'string', format: 'date-time' },
        },
        required: ['status', 'queues', 'timestamp'],
      },
      VersionInfo: {
        type: 'object',
        properties: {
          commit: { type: 'string', example: 'a1b2c3d' },
          branch: { type: 'string', example: 'main' },
          bundle: { type: 'string', example: 'index-BKdX3aRp.js' },
          chunks: { type: 'integer', example: 12 },
          builtAt: { type: 'string', format: 'date-time' },
          nodeVersion: { type: 'string', example: 'v20.18.0' },
          env: { type: 'string', enum: ['development', 'production', 'test'] },
        },
        required: ['commit', 'branch', 'bundle', 'chunks', 'builtAt', 'nodeVersion', 'env'],
      },
      Metrics: {
        type: 'object',
        properties: {
          uptime: { type: 'integer', description: 'Uptime em segundos' },
          memory: {
            type: 'object',
            properties: {
              heapUsedMB: { type: 'integer', example: 128 },
            },
            required: ['heapUsedMB'],
          },
          queues: {
            type: 'object',
            description: 'Contagem de jobs aguardando em cada fila (-1 = workers não iniciados)',
            properties: {
              pdf: { type: 'integer' },
              linkAcesso: { type: 'integer' },
              pesquisa: { type: 'integer' },
              lembrete: { type: 'integer' },
              nutricao: { type: 'integer' },
              exam: { type: 'integer' },
            },
          },
          circuits: {
            type: 'object',
            description: 'Estado dos circuit breakers',
            properties: {
              asaas: { type: 'string', enum: ['closed', 'open', 'half-open'] },
            },
          },
          staffWhatsappActiveDebounces: { type: 'integer', example: 0 },
          timestamp: { type: 'string', format: 'date-time' },
        },
        required: ['uptime', 'memory', 'queues', 'circuits', 'staffWhatsappActiveDebounces', 'timestamp'],
      },
      LlmUsage: {
        type: 'object',
        properties: {
          llm: {
            type: 'object',
            properties: {
              today: { type: 'integer', description: 'Chamadas de IA hoje', example: 15 },
              limit: { type: 'integer', description: 'Limite diário configurado', example: 200 },
              percentUsed: { type: 'integer', example: 8 },
              alert: { type: 'boolean', description: 'true quando ≥ 80% do limite foi usado' },
            },
            required: ['today', 'limit', 'percentUsed', 'alert'],
          },
          timestamp: { type: 'string', format: 'date-time' },
        },
        required: ['llm', 'timestamp'],
      },
      Observability: {
        type: 'object',
        properties: {
          sentry_server_configured: { type: 'boolean' },
          sentry_server_dsn_prefix: { type: 'string', nullable: true },
          node_env: { type: 'string' },
          release: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
        },
        required: ['sentry_server_configured', 'sentry_server_dsn_prefix', 'node_env', 'release', 'timestamp'],
      },
      UploadResponse: {
        type: 'object',
        properties: {
          exameId: { type: 'integer', example: 42 },
          s3Key: { type: 'string', example: 'exames/42/hiv-2024-01-15.jpg' },
          tamanhoBytes: { type: 'integer', example: 204800 },
          mimeType: { type: 'string', example: 'image/jpeg' },
        },
        required: ['exameId', 's3Key', 'tamanhoBytes', 'mimeType'],
      },
      Error401: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Token inválido' },
        },
        required: ['error'],
      },
      Error503: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'OPS_TOKEN não configurado no servidor' },
        },
        required: ['error'],
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Healthcheck básico',
        description: 'Verifica conectividade com o banco de dados e Redis. Não requer autenticação.',
        operationId: 'getHealth',
        responses: {
          '200': {
            description: 'Sistema operacional',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthBasic' },
                example: {
                  status: 'ok',
                  uptime: 7200,
                  version: '1.0.0',
                  db: 'ok',
                  redis: 'ok',
                  timestamp: '2024-01-15T10:30:00.000Z',
                },
              },
            },
          },
          '503': {
            description: 'Um ou mais componentes com falha',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthBasic' },
              },
            },
          },
        },
      },
    },
    '/health/deep': {
      get: {
        tags: ['Health'],
        summary: 'Healthcheck completo (DB + Redis + S3)',
        description: 'Verifica conectividade com banco, Redis e AWS S3. Mais lento — use para diagnóstico.',
        operationId: 'getHealthDeep',
        responses: {
          '200': {
            description: 'Todos os componentes operacionais',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthDeep' },
              },
            },
          },
          '503': {
            description: 'Um ou mais componentes com falha',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthDeep' },
              },
            },
          },
        },
      },
    },
    '/health/version': {
      get: {
        tags: ['Health'],
        summary: 'Informações de versão e build',
        description: 'Confirma que o deploy chegou à produção e qual bundle Vite está sendo servido.',
        operationId: 'getHealthVersion',
        responses: {
          '200': {
            description: 'Informações de versão',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/VersionInfo' },
              },
            },
          },
        },
      },
    },
    '/health/queues': {
      get: {
        tags: ['Operações'],
        summary: 'Estado detalhado das filas BullMQ',
        description:
          'Retorna waiting/active/delayed/failed/completed para cada fila. ' +
          '`status: "degraded"` indica jobs com falha. Requer `x-ops-token`.',
        operationId: 'getHealthQueues',
        security: [{ opsToken: [] }],
        responses: {
          '200': {
            description: 'Estado das filas',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthQueues' },
                example: {
                  status: 'ok',
                  queues: {
                    pdf: { waiting: 0, active: 0, delayed: 0, failed: 0, completed: 100 },
                    linkAcesso: { waiting: 0, active: 0, delayed: 0, failed: 0, completed: 50 },
                    pesquisa: { waiting: 1, active: 0, delayed: 0, failed: 0, completed: 200 },
                    lembrete: { waiting: 0, active: 0, delayed: 1, failed: 0, completed: 30 },
                    nutricao: { waiting: 0, active: 0, delayed: 0, failed: 0, completed: 10 },
                    exam: { waiting: 2, active: 1, delayed: 0, failed: 0, completed: 80 },
                  },
                  timestamp: '2024-01-15T10:30:00.000Z',
                },
              },
            },
          },
          '401': {
            description: 'Token inválido ou ausente',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error401' } } },
          },
          '503': {
            description: 'Falha ao consultar BullMQ',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                    detail: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/health/observability': {
      get: {
        tags: ['Operações'],
        summary: 'Status da observabilidade (Sentry)',
        description: 'Confirma que o Sentry está configurado no servidor. Requer `x-ops-token`.',
        operationId: 'getHealthObservability',
        security: [{ opsToken: [] }],
        responses: {
          '200': {
            description: 'Status de observabilidade',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Observability' } },
            },
          },
          '401': {
            description: 'Token inválido',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error401' } } },
          },
        },
      },
    },
    '/metrics': {
      get: {
        tags: ['Operações'],
        summary: 'Métricas operacionais',
        description:
          'Retorna profundidade das filas, uso de memória heap e estado dos circuit breakers. ' +
          'Requer `x-ops-token`.',
        operationId: 'getMetrics',
        security: [{ opsToken: [] }],
        responses: {
          '200': {
            description: 'Métricas do sistema',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Metrics' } },
            },
          },
          '401': {
            description: 'Token inválido',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error401' } } },
          },
          '503': {
            description: 'OPS_TOKEN não configurado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error503' } } },
          },
        },
      },
    },
    '/admin/usage': {
      get: {
        tags: ['Operações'],
        summary: 'Consumo diário de LLM vs limite',
        description:
          'Retorna quantas chamadas de IA foram feitas hoje e o percentual em relação ao limite diário (`LLM_DAILY_LIMIT`). ' +
          '`alert: true` quando ≥ 80% do limite foi consumido. Requer `x-ops-token`.',
        operationId: 'getAdminUsage',
        security: [{ opsToken: [] }],
        responses: {
          '200': {
            description: 'Uso de LLM',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LlmUsage' },
                example: {
                  llm: { today: 42, limit: 200, percentUsed: 21, alert: false },
                  timestamp: '2024-01-15T10:30:00.000Z',
                },
              },
            },
          },
          '401': {
            description: 'Token inválido',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error401' } } },
          },
        },
      },
    },
    '/upload': {
      post: {
        tags: ['Upload'],
        summary: 'Upload de exame',
        description:
          'Recebe um arquivo de exame (imagem ou PDF) via `multipart/form-data`, ' +
          'faz upload para o S3 e registra o exame no banco. ' +
          'Requer sessão de paciente autenticado (cookie `session`). ' +
          'Limite de tamanho: 10 MB. Formatos aceitos: JPEG, PNG, PDF, WEBP.',
        operationId: 'uploadExame',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'Arquivo do exame (JPEG, PNG, PDF, WEBP — máx 10 MB)',
                  },
                  tipoExame: {
                    type: 'string',
                    enum: ['hiv', 'hepatite_b', 'hepatite_c', 'sifilis', 'creatinina', 'outro'],
                    description: 'Tipo do exame',
                  },
                  pacienteId: {
                    type: 'integer',
                    description: 'ID do paciente',
                  },
                },
                required: ['file', 'tipoExame', 'pacienteId'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Upload realizado com sucesso',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/UploadResponse' } },
            },
          },
          '400': {
            description: 'Arquivo inválido (tipo não suportado, tamanho excedido, qualidade insuficiente)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { error: { type: 'string' } },
                  required: ['error'],
                },
              },
            },
          },
          '401': {
            description: 'Não autenticado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { error: { type: 'string' } },
                },
              },
            },
          },
          '429': {
            description: 'Rate limit de upload atingido',
          },
        },
      },
    },
    '/asaas/webhook': {
      post: {
        tags: ['Webhooks'],
        summary: 'Webhook de pagamentos Asaas',
        description:
          'Recebe notificações de eventos de pagamento da Asaas (PIX, boleto, cartão). ' +
          'Autenticado via token da Asaas no header `asaas-access-token`. ' +
          'Eventos suportados: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`.',
        operationId: 'asaasWebhook',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  event: {
                    type: 'string',
                    enum: ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 'PAYMENT_OVERDUE', 'PAYMENT_DELETED', 'PAYMENT_RESTORED'],
                    example: 'PAYMENT_RECEIVED',
                  },
                  payment: {
                    type: 'object',
                    description: 'Objeto de pagamento da Asaas',
                    properties: {
                      id: { type: 'string', example: 'pay_abc123' },
                      status: { type: 'string', example: 'RECEIVED' },
                      value: { type: 'number', example: 150.0 },
                      externalReference: { type: 'string', description: 'ID interno (pacienteId ou consultaId)' },
                    },
                  },
                },
                required: ['event', 'payment'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Evento processado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { received: { type: 'boolean', example: true } },
                },
              },
            },
          },
          '400': {
            description: 'Payload inválido ou evento não reconhecido',
          },
        },
      },
    },
  },
  'x-trpc-reference': {
    description:
      'As rotas tRPC são montadas em `/trpc/*` e usam o protocolo tRPC v11 (JSON-RPC sobre HTTP). ' +
      'Requests do tipo query usam GET; mutations usam POST. ' +
      'Autenticação via cookie `session` (JWT). ' +
      'Para uso em browsers, utilize o client tRPC gerado em `client/src/_core/trpc.ts`.',
    procedures: {
      'auth.iniciarLogin': {
        type: 'query',
        description: 'Inicia o fluxo OAuth — retorna URL de redirecionamento Google',
        access: 'public',
      },
      'auth.callback': {
        type: 'mutation',
        description: 'Processa callback OAuth, cria sessão JWT',
        access: 'public',
        rateLimit: '10 req/15min por IP',
      },
      'auth.logout': {
        type: 'mutation',
        description: 'Invalida sessão atual',
        access: 'protected',
      },
      'token.validar': {
        type: 'mutation',
        description: 'Valida token de acesso do paciente e cria sessão temporária',
        access: 'public',
        rateLimit: '5 req/15min por IP',
      },
      'paciente.salvarDadosPessoais': {
        type: 'mutation',
        description: 'Salva/atualiza dados pessoais do paciente (CPF criptografado via AES-256-GCM)',
        access: 'protected',
      },
      'paciente.buscarPorCpf': {
        type: 'query',
        description: 'Busca paciente por hash de CPF (sem descriptografar)',
        access: 'staff',
      },
      'medico.listarPendentes': {
        type: 'query',
        description: 'Lista pacientes com exames aguardando revisão médica',
        access: 'medico',
      },
      'medico.aprovar': {
        type: 'mutation',
        description: 'Aprova paciente e dispara geração de PDF com assinatura ICP-Brasil',
        access: 'medico',
      },
      'medico.rejeitar': {
        type: 'mutation',
        description: 'Rejeita paciente com motivo registrado em audit_logs',
        access: 'medico',
      },
      'medico.liberarExame': {
        type: 'mutation',
        description: 'Libera exame específico para reanálise por IA',
        access: 'medico',
      },
      'admin.listarUsuarios': {
        type: 'query',
        description: 'Lista todos os usuários da equipe',
        access: 'admin',
      },
      'admin.atualizarRole': {
        type: 'mutation',
        description: 'Atualiza role de um usuário (secretaria/medico/admin)',
        access: 'admin',
      },
      'secretaria.gerarToken': {
        type: 'mutation',
        description: 'Gera token de acesso para novo paciente',
        access: 'staff',
      },
      'intake.solicitarReenvioLink': {
        type: 'mutation',
        description: 'Reenvia link de acesso ao paciente por e-mail',
        access: 'public',
        rateLimit: '5 req/15min por IP',
      },
      'me.exportData': {
        type: 'query',
        description: 'Exporta todos os dados pessoais (LGPD — Art. 18 II)',
        access: 'protected',
        rateLimit: '3 req/hora por usuário',
      },
      'me.requestAnonymization': {
        type: 'mutation',
        description: 'Solicita anonimização de dados pessoais (LGPD — Art. 18 IV)',
        access: 'protected',
        rateLimit: '3 req/hora por usuário',
      },
      'twoFactor.setup': {
        type: 'mutation',
        description: 'Configura autenticação de dois fatores (TOTP)',
        access: 'protected',
      },
      'twoFactor.verify': {
        type: 'mutation',
        description: 'Verifica código TOTP',
        access: 'protected',
        rateLimit: '5 req/15min por IP',
      },
      'consulta.agendar': {
        type: 'mutation',
        description: 'Agenda consulta médica',
        access: 'protected',
      },
      'pesquisa.responder': {
        type: 'mutation',
        description: 'Registra resposta da pesquisa de satisfação pós-consulta',
        access: 'protected',
      },
    },
  },
}

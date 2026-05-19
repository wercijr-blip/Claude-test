const securityScheme = { BearerAuth: [[] ] }

const bearerAuth = { security: [{ BearerAuth: [] }] }

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Atos Saúde Bot — API',
    version: '1.0.0',
    description:
      'API REST do painel administrativo do bot WhatsApp da Atos Saúde Integrada.\n\n' +
      '**Autenticação:** Bearer JWT obtido em `POST /api/auth/login`.\n\n' +
      '**Roles:** `admin` · `secretaria` · `faturamento`',
    contact: { name: 'Atos Saúde Integrada', url: 'https://atossaude.com.br' }
  },
  servers: [{ url: '', description: 'Servidor atual' }],
  components: {
    securitySchemes: {
      BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
        required: ['error']
      },
      Ok: {
        type: 'object',
        properties: { ok: { type: 'boolean', example: true } },
        required: ['ok']
      },
      Agendamento: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          phone: { type: 'string', example: '5561999999999' },
          nome: { type: 'string' },
          nascimento: { type: 'string', format: 'date' },
          tipo: { type: 'string', enum: ['CONSULTA', 'INFUSAO', 'MEDICACAO'] },
          status: { type: 'string', enum: ['PENDENTE', 'CONFIRMADO', 'CANCELADO'] },
          especialidade: { type: 'string' },
          medico_nome: { type: 'string' },
          medico_id: { type: 'string' },
          slot_datetime: { type: 'string', format: 'date-time' },
          tipo_atendimento: { type: 'string', enum: ['CONVENIO', 'PARTICULAR'] },
          convenio_informado: { type: 'string', nullable: true },
          google_event_id: { type: 'string', nullable: true },
          exported: { type: 'integer', enum: [0, 1] },
          created_at: { type: 'string', format: 'date-time' }
        }
      },
      Doctor: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'dr_1234567890' },
          nome: { type: 'string' },
          crm: { type: 'string' },
          especialidade: { type: 'string' },
          email: { type: 'string', format: 'email' },
          calendarId: { type: 'string' },
          whatsapp: { type: 'string' },
          slotDurationMinutes: { type: 'integer', default: 30 },
          active: { type: 'boolean' }
        }
      },
      Usuario: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          username: { type: 'string' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'secretaria', 'faturamento'] },
          active: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' }
        }
      },
      Slot: {
        type: 'object',
        properties: {
          iso: { type: 'string', format: 'date-time' },
          hora: { type: 'string', example: '09:30' },
          doctorId: { type: 'string' },
          doctorNome: { type: 'string' },
          especialidade: { type: 'string' }
        }
      },
      Mensagem: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          phone: { type: 'string' },
          direction: { type: 'string', enum: ['IN', 'OUT'] },
          text: { type: 'string' },
          flow: { type: 'string' },
          step: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' }
        }
      }
    },
    responses: {
      Unauthorized: {
        description: 'Token JWT ausente ou inválido',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
      },
      Forbidden: {
        description: 'Role sem permissão para este endpoint',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
      },
      NotFound: {
        description: 'Recurso não encontrado',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
      }
    }
  },
  tags: [
    { name: 'Auth', description: 'Autenticação' },
    { name: 'Agendamentos', description: 'Gestão de consultas e procedimentos' },
    { name: 'Médicos', description: 'Cadastro e agenda de médicos' },
    { name: 'Calendário', description: 'Slots disponíveis e bloqueios' },
    { name: 'Usuários', description: 'Gestão de operadores do painel' },
    { name: 'Pacientes', description: 'LGPD — direito ao esquecimento' },
    { name: 'Conversas', description: 'Monitor de conversas WhatsApp' },
    { name: 'WhatsApp', description: 'Status e controle da instância Evolution API' },
    { name: 'Base de conhecimento', description: 'Documentos para FAQ por IA' },
    { name: 'Fila de encaixe', description: 'Pacientes aguardando slot liberado' },
    { name: 'Sessões', description: 'Sessões de atendimento humano' },
    { name: 'Satisfação', description: 'Pesquisa de satisfação pós-consulta' },
    { name: 'Exportação', description: 'Exportação de dados em Excel' },
    { name: 'Exames', description: 'Exames enviados via WhatsApp' },
    { name: 'Textos', description: 'Mensagens configuráveis do bot' },
    { name: 'Estatísticas', description: 'Painel de métricas' },
    { name: 'Sistema', description: 'Health check e eventos SSE' }
  ],
  paths: {
    // ─── Sistema ──────────────────────────────────────────────────────────────
    '/health': {
      get: {
        tags: ['Sistema'],
        summary: 'Health check',
        description: 'Verifica disponibilidade do serviço e do banco de dados.',
        security: [],
        responses: {
          200: {
            description: 'Serviço saudável',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    uptime: { type: 'number' },
                    db: { type: 'string', enum: ['ok', 'error'] },
                    ts: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          },
          503: { description: 'Banco de dados indisponível' }
        }
      }
    },
    '/api/events': {
      get: {
        tags: ['Sistema'],
        summary: 'Stream SSE de eventos em tempo real',
        description:
          'EventSource. Autenticação via query param `?token=<jwt>` (EventSource não suporta headers).\n\n' +
          'Eventos emitidos: `agendamento_update`, `encaixe_update`, `session_update`.',
        parameters: [
          { name: 'token', in: 'query', required: true, schema: { type: 'string' }, description: 'JWT token' }
        ],
        responses: {
          200: { description: 'Stream text/event-stream' },
          401: { description: 'Token inválido' },
          403: { description: 'Role sem permissão (exige admin ou secretaria)' }
        }
      }
    },
    // ─── Auth ──────────────────────────────────────────────────────────────────
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: { type: 'string', example: 'secretaria' },
                  password: { type: 'string', format: 'password', example: 'Senha@123' }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Login bem-sucedido',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' },
                    user: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        username: { type: 'string' },
                        name: { type: 'string' },
                        role: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/api/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout',
        ...bearerAuth,
        responses: {
          200: { description: 'Logout realizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Ok' } } } },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    // ─── Estatísticas ─────────────────────────────────────────────────────────
    '/api/stats': {
      get: {
        tags: ['Estatísticas'],
        summary: 'Métricas do dia',
        ...bearerAuth,
        responses: {
          200: {
            description: 'Contadores do dia corrente',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    hoje: { type: 'integer' },
                    consultas: { type: 'integer' },
                    infusoes: { type: 'integer' },
                    medicacoes: { type: 'integer' },
                    particulares: { type: 'integer' },
                    pendentes: { type: 'integer' }
                  }
                }
              }
            }
          }
        }
      }
    },
    // ─── Agendamentos ─────────────────────────────────────────────────────────
    '/api/agendamentos': {
      get: {
        tags: ['Agendamentos'],
        summary: 'Listar agendamentos',
        ...bearerAuth,
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDENTE', 'CONFIRMADO', 'CANCELADO'] } },
          { name: 'tipo', in: 'query', schema: { type: 'string', enum: ['CONSULTA', 'INFUSAO', 'MEDICACAO'] } },
          { name: 'especialidade', in: 'query', schema: { type: 'string' } },
          { name: 'data', in: 'query', schema: { type: 'string', format: 'date', example: '2025-01-20' } }
        ],
        responses: {
          200: {
            description: 'Lista paginada de agendamentos',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/Agendamento' } }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/agendamentos/manual': {
      post: {
        tags: ['Agendamentos'],
        summary: 'Criar agendamento manual (secretaria)',
        ...bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['doctorId', 'slotISO', 'nome', 'nascimento', 'telefone', 'tipoAtendimento'],
                properties: {
                  doctorId: { type: 'string' },
                  slotISO: { type: 'string', format: 'date-time' },
                  nome: { type: 'string' },
                  nascimento: { type: 'string', format: 'date' },
                  telefone: { type: 'string' },
                  tipoAtendimento: { type: 'string', enum: ['CONVENIO', 'PARTICULAR'] },
                  convenio: { type: 'string' },
                  phone: { type: 'string', description: 'WhatsApp do paciente (opcional, para confirmação)' }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Agendamento criado',
            content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, agId: { type: 'integer' }, googleEventId: { type: 'string', nullable: true } } } } }
          },
          400: { $ref: '#/components/responses/NotFound' },
          403: { $ref: '#/components/responses/Forbidden' }
        }
      }
    },
    '/api/agendamentos/{id}/cancelar': {
      post: {
        tags: ['Agendamentos'],
        summary: 'Cancelar agendamento (notifica paciente)',
        ...bearerAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Agendamento cancelado', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, gcalRemovido: { type: 'boolean' }, pacienteNotificado: { type: 'boolean' } } } } } },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' }
        }
      }
    },
    '/api/agendamentos/{id}/status': {
      patch: {
        tags: ['Agendamentos'],
        summary: 'Atualizar status do agendamento',
        ...bearerAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['PENDENTE', 'CONFIRMADO', 'CANCELADO'] } } } } }
        },
        responses: {
          200: { description: 'Status atualizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Ok' } } } },
          400: { description: 'Status inválido' },
          404: { $ref: '#/components/responses/NotFound' }
        }
      }
    },
    '/api/agendamentos/{id}/cancelar-encaixe': {
      post: {
        tags: ['Agendamentos', 'Fila de encaixe'],
        summary: 'Cancelar e notificar fila de encaixe',
        ...bearerAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Fila notificada', content: { 'application/json': { schema: { $ref: '#/components/schemas/Ok' } } } },
          400: { description: 'Agendamento não está cancelado' },
          404: { $ref: '#/components/responses/NotFound' }
        }
      }
    },
    '/api/agendamentos/export': {
      get: {
        tags: ['Exportação'],
        summary: 'Exportar agendamentos para Excel',
        ...bearerAuth,
        parameters: [
          { name: 'all', in: 'query', schema: { type: 'boolean' }, description: 'Se true, exporta todos (incluindo já exportados)' }
        ],
        responses: {
          200: { description: 'Arquivo .xlsx', content: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {} } },
          403: { $ref: '#/components/responses/Forbidden' }
        }
      }
    },
    // ─── Médicos ──────────────────────────────────────────────────────────────
    '/api/medicos': {
      get: {
        tags: ['Médicos'],
        summary: 'Listar médicos ativos',
        ...bearerAuth,
        responses: {
          200: {
            description: 'Lista de médicos ativos',
            content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Doctor' } } } } } }
          }
        }
      },
      post: {
        tags: ['Médicos'],
        summary: 'Criar médico (admin)',
        ...bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['nome'],
                properties: {
                  nome: { type: 'string' },
                  especialidade: { type: 'string' },
                  crm: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  whatsapp: { type: 'string' },
                  calendarId: { type: 'string' },
                  slotDurationMinutes: { type: 'integer', default: 30 },
                  diasSemana: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 } },
                  horarioInicio: { type: 'string', example: '08:00' },
                  horarioFim: { type: 'string', example: '18:00' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Médico criado', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, data: { $ref: '#/components/schemas/Doctor' } } } } } },
          403: { $ref: '#/components/responses/Forbidden' }
        }
      }
    },
    '/api/medicos/{id}': {
      delete: {
        tags: ['Médicos'],
        summary: 'Desativar médico (admin)',
        ...bearerAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Médico desativado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Ok' } } } },
          404: { $ref: '#/components/responses/NotFound' }
        }
      }
    },
    '/api/medicos/{id}/toggle': {
      patch: {
        tags: ['Médicos'],
        summary: 'Ativar / desativar médico (admin)',
        ...bearerAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Status alterado', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, active: { type: 'boolean' } } } } } },
          404: { $ref: '#/components/responses/NotFound' }
        }
      }
    },
    '/api/medicos/{id}/slots': {
      get: {
        tags: ['Médicos', 'Calendário'],
        summary: 'Slots disponíveis por médico e data',
        ...bearerAuth,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'date', in: 'query', required: true, schema: { type: 'string', format: 'date' } }
        ],
        responses: {
          200: { description: 'Slots do dia', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Slot' } } } } },
          400: { description: 'date é obrigatório' }
        }
      }
    },
    // ─── Calendário ───────────────────────────────────────────────────────────
    '/api/calendar/bloquear': {
      post: {
        tags: ['Calendário'],
        summary: 'Bloquear período na agenda (cancela consultas existentes)',
        ...bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['doctorId', 'startISO', 'endISO'],
                properties: {
                  doctorId: { type: 'string' },
                  startISO: { type: 'string', format: 'date-time' },
                  endISO: { type: 'string', format: 'date-time' },
                  motivo: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Período bloqueado',
            content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, blockEventId: { type: 'string', nullable: true }, pacientesNotificados: { type: 'integer' }, detalhes: { type: 'array', items: { type: 'object' } } } } } }
          }
        }
      }
    },
    '/api/slots': {
      get: {
        tags: ['Calendário'],
        summary: 'Slots disponíveis (genérico)',
        ...bearerAuth,
        parameters: [
          { name: 'doctorId', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'date', in: 'query', required: true, schema: { type: 'string', format: 'date' } }
        ],
        responses: {
          200: { description: 'Lista de slots', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Slot' } } } } }
        }
      }
    },
    // ─── Usuários ─────────────────────────────────────────────────────────────
    '/api/usuarios': {
      get: {
        tags: ['Usuários'],
        summary: 'Listar operadores (admin)',
        ...bearerAuth,
        responses: {
          200: { description: 'Lista de usuários', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Usuario' } } } } } } }
        }
      },
      post: {
        tags: ['Usuários'],
        summary: 'Criar operador (admin)',
        ...bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'name', 'role', 'password'],
                properties: {
                  username: { type: 'string' },
                  name: { type: 'string' },
                  role: { type: 'string', enum: ['admin', 'secretaria', 'faturamento'] },
                  password: { type: 'string', minLength: 6 }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Usuário criado', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, id: { type: 'integer' } } } } } },
          400: { description: 'Campos inválidos' },
          409: { description: 'Username já existe' }
        }
      }
    },
    '/api/usuarios/{id}/toggle': {
      patch: {
        tags: ['Usuários'],
        summary: 'Ativar / desativar operador (admin)',
        ...bearerAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Status alterado', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, active: { type: 'boolean' } } } } } },
          404: { $ref: '#/components/responses/NotFound' }
        }
      }
    },
    '/api/usuarios/{id}/reset-senha': {
      patch: {
        tags: ['Usuários'],
        summary: 'Redefinir senha de operador (admin)',
        ...bearerAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['password'], properties: { password: { type: 'string', minLength: 6 } } } } }
        },
        responses: {
          200: { description: 'Senha redefinida', content: { 'application/json': { schema: { $ref: '#/components/schemas/Ok' } } } },
          400: { description: 'Senha muito curta (mín 6 caracteres)' }
        }
      }
    },
    // ─── Pacientes / LGPD ─────────────────────────────────────────────────────
    '/api/pacientes/{phone}': {
      delete: {
        tags: ['Pacientes'],
        summary: 'Direito ao esquecimento — LGPD art. 18 III (admin)',
        description:
          'Remove todos os dados pessoais do paciente:\n\n' +
          '- **Deleta**: messages_log, satisfaction_responses, authorization_queries, sessions, encaixe_queue\n' +
          '- **Anonimiza**: agendamentos (nome/nascimento/telefone → `[REMOVIDO]`) — CFM exige retenção de 20 anos',
        ...bearerAuth,
        parameters: [
          { name: 'phone', in: 'path', required: true, schema: { type: 'string', pattern: '^\\d{10,15}$' }, example: '5561999999999' }
        ],
        responses: {
          200: { description: 'Dados removidos', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, message: { type: 'string' } } } } } },
          400: { description: 'Número de telefone inválido' },
          403: { $ref: '#/components/responses/Forbidden' }
        }
      }
    },
    // ─── Conversas ────────────────────────────────────────────────────────────
    '/api/conversations': {
      get: {
        tags: ['Conversas'],
        summary: 'Listar conversas com última mensagem',
        ...bearerAuth,
        parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', default: 100, maximum: 500 } }],
        responses: {
          200: { description: 'Conversas', content: { 'application/json': { schema: { type: 'object', properties: { total: { type: 'integer' }, data: { type: 'array', items: { type: 'object' } } } } } } }
        }
      }
    },
    '/api/conversations/{phone}': {
      get: {
        tags: ['Conversas'],
        summary: 'Histórico completo de conversa com um número',
        ...bearerAuth,
        parameters: [{ name: 'phone', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Mensagens da conversa', content: { 'application/json': { schema: { type: 'object', properties: { phone: { type: 'string' }, total: { type: 'integer' }, data: { type: 'array', items: { $ref: '#/components/schemas/Mensagem' } } } } } } }
        }
      }
    },
    '/api/conversations/{phone}/reply': {
      post: {
        tags: ['Conversas'],
        summary: 'Responder paciente via WhatsApp (operador assume sessão)',
        ...bearerAuth,
        parameters: [{ name: 'phone', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['text'], properties: { text: { type: 'string' } } } } }
        },
        responses: {
          200: { description: 'Mensagem enviada', content: { 'application/json': { schema: { $ref: '#/components/schemas/Ok' } } } },
          400: { description: 'Texto obrigatório' }
        }
      }
    },
    // ─── WhatsApp ─────────────────────────────────────────────────────────────
    '/api/whatsapp/status': {
      get: {
        tags: ['WhatsApp'],
        summary: 'Estado da instância WhatsApp (admin)',
        ...bearerAuth,
        responses: {
          200: { description: 'Estado da conexão Evolution API', content: { 'application/json': { schema: { type: 'object' } } } },
          502: { description: 'Evolution API indisponível' }
        }
      }
    },
    '/api/whatsapp/qr': {
      get: {
        tags: ['WhatsApp'],
        summary: 'Obter QR code para conectar (admin)',
        ...bearerAuth,
        responses: {
          200: { description: 'QR code ou código de pareamento', content: { 'application/json': { schema: { type: 'object' } } } },
          502: { description: 'Evolution API indisponível' }
        }
      }
    },
    '/api/whatsapp/logout': {
      post: {
        tags: ['WhatsApp'],
        summary: 'Desconectar instância WhatsApp (admin)',
        ...bearerAuth,
        responses: {
          200: { description: 'Logout realizado', content: { 'application/json': { schema: { type: 'object' } } } },
          502: { description: 'Evolution API indisponível' }
        }
      }
    },
    '/api/whatsapp/restart': {
      post: {
        tags: ['WhatsApp'],
        summary: 'Reiniciar instância WhatsApp (admin)',
        ...bearerAuth,
        responses: {
          200: { description: 'Instância reiniciada', content: { 'application/json': { schema: { type: 'object' } } } },
          502: { description: 'Evolution API indisponível' }
        }
      }
    },
    // ─── Base de conhecimento ─────────────────────────────────────────────────
    '/api/knowledge': {
      get: {
        tags: ['Base de conhecimento'],
        summary: 'Listar documentos e estatísticas de perguntas por IA',
        ...bearerAuth,
        responses: {
          200: {
            description: 'Documentos e stats',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    documents: { type: 'array', items: { type: 'object', properties: { id: { type: 'integer' }, filename: { type: 'string' }, category: { type: 'string' }, active: { type: 'boolean' } } } },
                    stats: { type: 'object', properties: { perguntasHoje: { type: 'integer' }, taxaResolucao: { type: 'integer', description: 'Percentual HIGH confidence' } } }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/knowledge/upload': {
      post: {
        tags: ['Base de conhecimento'],
        summary: 'Fazer upload de documento PDF / DOCX / TXT (admin)',
        ...bearerAuth,
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } }
        },
        responses: {
          200: { description: 'Documento ingerido', content: { 'application/json': { schema: { type: 'object' } } } },
          400: { description: 'Arquivo inválido ou não enviado' }
        }
      }
    },
    '/api/knowledge/{id}': {
      delete: {
        tags: ['Base de conhecimento'],
        summary: 'Desativar documento (admin)',
        ...bearerAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Documento desativado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Ok' } } } }
        }
      }
    },
    // ─── Fila de encaixe ──────────────────────────────────────────────────────
    '/api/encaixe': {
      get: {
        tags: ['Fila de encaixe'],
        summary: 'Listar fila de encaixe',
        ...bearerAuth,
        responses: {
          200: { description: 'Pacientes na fila', content: { 'application/json': { schema: { type: 'array', items: { type: 'object' } } } } }
        }
      },
      post: {
        tags: ['Fila de encaixe'],
        summary: 'Adicionar paciente à fila de encaixe',
        ...bearerAuth,
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['phone'], properties: { phone: { type: 'string' }, nome: { type: 'string' }, especialidade: { type: 'string' }, medico_id: { type: 'string' } } } } }
        },
        responses: {
          200: { description: 'Adicionado à fila', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, id: { type: 'integer' } } } } } },
          400: { description: 'phone é obrigatório' }
        }
      }
    },
    '/api/encaixe/{id}': {
      delete: {
        tags: ['Fila de encaixe'],
        summary: 'Remover paciente da fila de encaixe',
        ...bearerAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Removido da fila', content: { 'application/json': { schema: { $ref: '#/components/schemas/Ok' } } } }
        }
      }
    },
    // ─── Sessões ──────────────────────────────────────────────────────────────
    '/api/sessions/humanas': {
      get: {
        tags: ['Sessões'],
        summary: 'Listar sessões aguardando atendimento humano',
        ...bearerAuth,
        responses: {
          200: { description: 'Sessões humanas ativas', content: { 'application/json': { schema: { type: 'object', properties: { total: { type: 'integer' }, data: { type: 'array', items: { type: 'object' } } } } } } }
        }
      }
    },
    '/api/sessions/{phone}/assume': {
      post: {
        tags: ['Sessões'],
        summary: 'Operador assume atendimento humano',
        ...bearerAuth,
        parameters: [{ name: 'phone', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Sessão assumida', content: { 'application/json': { schema: { $ref: '#/components/schemas/Ok' } } } }
        }
      }
    },
    '/api/sessions/{phone}/encerrar': {
      post: {
        tags: ['Sessões'],
        summary: 'Encerrar sessão de atendimento humano',
        ...bearerAuth,
        parameters: [{ name: 'phone', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Sessão encerrada', content: { 'application/json': { schema: { $ref: '#/components/schemas/Ok' } } } }
        }
      }
    },
    // ─── Satisfação ───────────────────────────────────────────────────────────
    '/api/satisfaction': {
      get: {
        tags: ['Satisfação'],
        summary: 'Respostas de pesquisa de satisfação',
        ...bearerAuth,
        responses: {
          200: {
            description: 'Respostas e estatísticas',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { type: 'object' } },
                    stats: {
                      type: 'object',
                      properties: {
                        media: { type: 'number' },
                        total: { type: 'integer' },
                        excelente: { type: 'integer' },
                        bom: { type: 'integer' },
                        regular: { type: 'integer' },
                        ruim: { type: 'integer' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    // ─── Exportação ───────────────────────────────────────────────────────────
    '/api/export': {
      post: {
        tags: ['Exportação'],
        summary: 'Exportar agendamentos pendentes para Excel (admin/faturamento)',
        ...bearerAuth,
        parameters: [{ name: 'all', in: 'query', schema: { type: 'boolean' } }],
        responses: {
          200: { description: 'Download .xlsx', content: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {} } },
          403: { $ref: '#/components/responses/Forbidden' }
        }
      }
    },
    // ─── Exames ───────────────────────────────────────────────────────────────
    '/api/exames': {
      get: {
        tags: ['Exames'],
        summary: 'Listar exames enviados via WhatsApp',
        ...bearerAuth,
        responses: {
          200: { description: 'Exames', content: { 'application/json': { schema: { type: 'object', properties: { total: { type: 'integer' }, data: { type: 'array', items: { type: 'object' } } } } } } }
        }
      }
    },
    '/api/exames/{id}/download': {
      get: {
        tags: ['Exames'],
        summary: 'Download do arquivo de exame',
        ...bearerAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Arquivo do exame' },
          404: { $ref: '#/components/responses/NotFound' }
        }
      }
    },
    // ─── Textos ───────────────────────────────────────────────────────────────
    '/api/textos': {
      get: {
        tags: ['Textos'],
        summary: 'Listar mensagens configuráveis do bot (admin)',
        ...bearerAuth,
        responses: {
          200: { description: 'Mensagens configuráveis', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, nome: { type: 'string' }, conteudo: { type: 'string' } } } } } } } } }
        }
      },
      post: {
        tags: ['Textos'],
        summary: 'Adicionar / editar mensagem (admin)',
        ...bearerAuth,
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['nome', 'conteudo'], properties: { nome: { type: 'string' }, conteudo: { type: 'string' } } } } }
        },
        responses: {
          200: { description: 'Mensagem salva', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, id: { type: 'string' } } } } } }
        }
      },
      put: {
        tags: ['Textos'],
        summary: 'Substituir todas as mensagens de uma vez (admin)',
        ...bearerAuth,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Mensagens substituídas', content: { 'application/json': { schema: { $ref: '#/components/schemas/Ok' } } } } }
      }
    },
    '/api/textos/{id}': {
      delete: {
        tags: ['Textos'],
        summary: 'Remover mensagem configurável (admin)',
        ...bearerAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Mensagem removida', content: { 'application/json': { schema: { $ref: '#/components/schemas/Ok' } } } },
          404: { $ref: '#/components/responses/NotFound' }
        }
      }
    },
    // ─── Medication requests ──────────────────────────────────────────────────
    '/api/medication-requests': {
      get: {
        tags: ['Agendamentos'],
        summary: 'Listar solicitações de medicação',
        ...bearerAuth,
        responses: {
          200: { description: 'Solicitações de medicação', content: { 'application/json': { schema: { type: 'object', properties: { total: { type: 'integer' }, data: { type: 'array', items: { type: 'object' } } } } } } }
        }
      }
    }
  }
}

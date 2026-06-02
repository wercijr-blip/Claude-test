CREATE TABLE `access_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`patient_email` varchar(255),
	`tipo` varchar(20) NOT NULL DEFAULT 'privado',
	`convenio` varchar(100),
	`used_at` datetime,
	`expires_at` datetime NOT NULL,
	`revoked_at` datetime,
	`created_by_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `access_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_access_tokens_hash` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actor_id` int,
	`actor_role` varchar(50),
	`action` varchar(100) NOT NULL,
	`resource_type` varchar(50) NOT NULL,
	`resource_id` int,
	`detalhes` json,
	`ip_address` varchar(45),
	`user_agent` text,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consultas_inicio` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token_id` int NOT NULL,
	`tipo_consulta` varchar(50),
	`tem_exame_recente` boolean,
	`exame_s3_key` varchar(500),
	`pedido_completo_s3_key` varchar(500),
	`pedido_ist_s3_key` varchar(500),
	`pedido_hiv_s3_key` varchar(500),
	`pedido_densitometria_s3_key` varchar(500),
	`status` varchar(50) NOT NULL DEFAULT 'aguardando_escolha',
	`resultado_ia` json,
	`motivo_rejeicao` varchar(200),
	`tentativas_reenvio` int NOT NULL DEFAULT 0,
	`validado_por_id` int,
	`validado_em` datetime,
	`data_exame_validado` varchar(20),
	`resultado_hiv_validado` varchar(20),
	`observacoes_medico` text,
	`ultimo_lembrete_at` datetime,
	`link_expires_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `consultas_inicio_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_consultas_inicio_token` UNIQUE(`token_id`)
);
--> statement-breakpoint
CREATE TABLE `dlq_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`queue` varchar(100) NOT NULL,
	`job_id` varchar(200),
	`job_name` varchar(100) NOT NULL,
	`data` json,
	`fail_reason` text,
	`attempts` int DEFAULT 0,
	`reprocessing_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `dlq_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exames` (
	`id` int AUTO_INCREMENT NOT NULL,
	`paciente_id` int NOT NULL,
	`s3_key` varchar(500) NOT NULL,
	`nome_arquivo` varchar(255) NOT NULL,
	`tipo_exame` varchar(100),
	`mime_type` varchar(100),
	`tamanho_bytes` int,
	`resultado_ia` json,
	`revisado_por_id` int,
	`revisado_em` datetime,
	`liberado_por_medico_id` int,
	`liberado_em` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `exames_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nfse_registros` (
	`id` int AUTO_INCREMENT NOT NULL,
	`paciente_id` int,
	`precadastro_id` int,
	`numero_nfse` varchar(50),
	`status` varchar(50) NOT NULL DEFAULT 'pendente',
	`valor_centavos` int NOT NULL,
	`focusnfe_ref` varchar(100),
	`erro_descricao` text,
	`emitido_em` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `nfse_registros_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pacientes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token_id` int NOT NULL,
	`cpf_encrypted` text NOT NULL,
	`cpf_hash` varchar(64) NOT NULL,
	`nome_encrypted` text NOT NULL,
	`data_nascimento_encrypted` text,
	`nome_mae_encrypted` text,
	`cns` varchar(20),
	`sexo` varchar(20),
	`nome_social` varchar(255),
	`cor_raca` varchar(50),
	`escolaridade` varchar(100),
	`situacao_conjugal` varchar(50),
	`renda_familiar` varchar(50),
	`ocupacao` varchar(100),
	`identidade_genero` varchar(50),
	`orientacao_sexual` varchar(50),
	`uf_nascimento` varchar(2),
	`municipio_nascimento` varchar(100),
	`situacao_rua` boolean,
	`privado_liberdade` boolean,
	`email_encrypted` text,
	`tipo_telefone` varchar(20),
	`telefone_encrypted` text,
	`permite_contato` boolean,
	`tipo_contato` varchar(20),
	`cep` varchar(10),
	`logradouro` varchar(255),
	`numero` varchar(20),
	`complemento` varchar(100),
	`bairro` varchar(100),
	`cidade` varchar(100),
	`estado` varchar(2),
	`conduta_json` json,
	`prescricao_json` json,
	`prep_modalidade` varchar(30),
	`tipo_atendimento` varchar(50),
	`convenio` varchar(100),
	`numero_convenio` varchar(100),
	`valor_centavos` int,
	`autorizados_json` json,
	`status` varchar(50) NOT NULL DEFAULT 'rascunho',
	`current_step` int NOT NULL DEFAULT 1,
	`medico_id` int,
	`observacoes_medico` text,
	`retention_until` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `pacientes_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_pacientes_token` UNIQUE(`token_id`)
);
--> statement-breakpoint
CREATE TABLE `pagamentos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`paciente_id` int NOT NULL,
	`provider` varchar(20) NOT NULL DEFAULT 'asaas',
	`asaas_payment_id` varchar(100),
	`stripe_payment_id` varchar(100),
	`stripe_session_id` varchar(100),
	`status` varchar(50) NOT NULL DEFAULT 'pendente',
	`valor_centavos` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `pagamentos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pdfs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`paciente_id` int NOT NULL,
	`s3_key` varchar(500) NOT NULL,
	`tipo` varchar(50) NOT NULL,
	`certificado_serial` varchar(100),
	`assinado_em` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `pdfs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pesquisa_tokens` (
	`paciente_id` int NOT NULL,
	`token` varchar(64) NOT NULL,
	`criado_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`expira_em` datetime NOT NULL,
	CONSTRAINT `pesquisa_tokens_paciente_id` PRIMARY KEY(`paciente_id`),
	CONSTRAINT `idx_pesquisa_token` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `precadastros` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome_encrypted` text NOT NULL,
	`telefone_encrypted` text NOT NULL,
	`cpf_encrypted` text NOT NULL,
	`cpf_hash` varchar(64) NOT NULL,
	`email_encrypted` text NOT NULL,
	`tipo` varchar(20) NOT NULL,
	`plano` varchar(100),
	`carteirinha_s3_key` varchar(500),
	`documento_s3_key` varchar(500),
	`status` varchar(50) NOT NULL DEFAULT 'aguardando',
	`stripe_session_id` varchar(200),
	`access_token_id` int,
	`validado_por_id` int,
	`validado_em` datetime,
	`observacoes` text,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `precadastros_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `satisfacao_pesquisas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`paciente_id` int NOT NULL,
	`achou_facil` boolean,
	`conseguiu_medicacao` boolean,
	`indicaria` boolean,
	`comentario` text,
	`respondido_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `satisfacao_pesquisas_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_satisfacao_paciente` UNIQUE(`paciente_id`)
);
--> statement-breakpoint
CREATE TABLE `security_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tipo_evento` varchar(100) NOT NULL,
	`user_id` int,
	`ip_address` varchar(45),
	`user_agent` text,
	`detalhes` json,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `security_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stripe_events` (
	`event_id` varchar(100) NOT NULL,
	`type` varchar(100) NOT NULL,
	`processado_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `stripe_events_event_id` PRIMARY KEY(`event_id`)
);
--> statement-breakpoint
CREATE TABLE `tcle_assinaturas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`paciente_id` int NOT NULL,
	`assinatura_data_url` text,
	`ip_address` varchar(45),
	`user_agent` text,
	`signed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `tcle_assinaturas_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_tcle_paciente` UNIQUE(`paciente_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`open_id` varchar(255) NOT NULL,
	`email` varchar(255),
	`nome` varchar(255),
	`role` varchar(50) NOT NULL DEFAULT 'user',
	`ativo` boolean NOT NULL DEFAULT true,
	`totp_secret_encrypted` text,
	`totp_enabled` boolean NOT NULL DEFAULT false,
	`totp_backup_codes` json,
	`deleted_at` datetime,
	`deleted_by` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_users_open_id` UNIQUE(`open_id`)
);
--> statement-breakpoint
ALTER TABLE `access_tokens` ADD CONSTRAINT `access_tokens_created_by_id_users_id_fk` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_actor_id_users_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `consultas_inicio` ADD CONSTRAINT `consultas_inicio_token_id_access_tokens_id_fk` FOREIGN KEY (`token_id`) REFERENCES `access_tokens`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `consultas_inicio` ADD CONSTRAINT `consultas_inicio_validado_por_id_users_id_fk` FOREIGN KEY (`validado_por_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `exames` ADD CONSTRAINT `exames_paciente_id_pacientes_id_fk` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `exames` ADD CONSTRAINT `exames_revisado_por_id_users_id_fk` FOREIGN KEY (`revisado_por_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `exames` ADD CONSTRAINT `exames_liberado_por_medico_id_users_id_fk` FOREIGN KEY (`liberado_por_medico_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `nfse_registros` ADD CONSTRAINT `nfse_registros_paciente_id_pacientes_id_fk` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `nfse_registros` ADD CONSTRAINT `nfse_registros_precadastro_id_precadastros_id_fk` FOREIGN KEY (`precadastro_id`) REFERENCES `precadastros`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pacientes` ADD CONSTRAINT `pacientes_token_id_access_tokens_id_fk` FOREIGN KEY (`token_id`) REFERENCES `access_tokens`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pacientes` ADD CONSTRAINT `pacientes_medico_id_users_id_fk` FOREIGN KEY (`medico_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pagamentos` ADD CONSTRAINT `pagamentos_paciente_id_pacientes_id_fk` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pdfs` ADD CONSTRAINT `pdfs_paciente_id_pacientes_id_fk` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pesquisa_tokens` ADD CONSTRAINT `pesquisa_tokens_paciente_id_pacientes_id_fk` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `precadastros` ADD CONSTRAINT `precadastros_access_token_id_access_tokens_id_fk` FOREIGN KEY (`access_token_id`) REFERENCES `access_tokens`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `precadastros` ADD CONSTRAINT `precadastros_validado_por_id_users_id_fk` FOREIGN KEY (`validado_por_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `satisfacao_pesquisas` ADD CONSTRAINT `satisfacao_pesquisas_paciente_id_pacientes_id_fk` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `security_events` ADD CONSTRAINT `security_events_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tcle_assinaturas` ADD CONSTRAINT `tcle_assinaturas_paciente_id_pacientes_id_fk` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_access_tokens_created_by` ON `access_tokens` (`created_by_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_actor` ON `audit_log` (`actor_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_action` ON `audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `idx_audit_resource` ON `audit_log` (`resource_type`,`resource_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_created` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_consultas_inicio_status` ON `consultas_inicio` (`status`);--> statement-breakpoint
CREATE INDEX `idx_dlq_queue` ON `dlq_jobs` (`queue`);--> statement-breakpoint
CREATE INDEX `idx_dlq_created` ON `dlq_jobs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_exames_paciente` ON `exames` (`paciente_id`);--> statement-breakpoint
CREATE INDEX `idx_nfse_paciente` ON `nfse_registros` (`paciente_id`);--> statement-breakpoint
CREATE INDEX `idx_nfse_precadastro` ON `nfse_registros` (`precadastro_id`);--> statement-breakpoint
CREATE INDEX `idx_pacientes_cpf_hash` ON `pacientes` (`cpf_hash`);--> statement-breakpoint
CREATE INDEX `idx_pacientes_status` ON `pacientes` (`status`);--> statement-breakpoint
CREATE INDEX `idx_pacientes_medico` ON `pacientes` (`medico_id`);--> statement-breakpoint
CREATE INDEX `idx_pagamentos_paciente` ON `pagamentos` (`paciente_id`);--> statement-breakpoint
CREATE INDEX `idx_pagamentos_asaas` ON `pagamentos` (`asaas_payment_id`);--> statement-breakpoint
CREATE INDEX `idx_pagamentos_session` ON `pagamentos` (`stripe_session_id`);--> statement-breakpoint
CREATE INDEX `idx_pdfs_paciente` ON `pdfs` (`paciente_id`);--> statement-breakpoint
CREATE INDEX `idx_precad_cpf_hash` ON `precadastros` (`cpf_hash`);--> statement-breakpoint
CREATE INDEX `idx_precad_status` ON `precadastros` (`status`);--> statement-breakpoint
CREATE INDEX `idx_precad_session` ON `precadastros` (`stripe_session_id`);--> statement-breakpoint
CREATE INDEX `idx_sec_tipo` ON `security_events` (`tipo_evento`);--> statement-breakpoint
CREATE INDEX `idx_sec_created` ON `security_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_sec_user` ON `security_events` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_users_role` ON `users` (`role`);
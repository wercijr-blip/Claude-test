CREATE TABLE `clinical_digests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`medico_id` int NOT NULL,
	`tipo` varchar(10) NOT NULL,
	`periodo_ref` varchar(20) NOT NULL,
	`texto` text NOT NULL,
	`total_consultas` int NOT NULL DEFAULT 0,
	`total_alertas` int NOT NULL DEFAULT 0,
	`gerado_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`batch_id` varchar(255),
	`obsidian_path` varchar(500),
	CONSTRAINT `clinical_digests_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_cdigests_periodo` UNIQUE(`medico_id`,`tipo`,`periodo_ref`)
);
--> statement-breakpoint
CREATE TABLE `clinical_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`medico_id` int NOT NULL,
	`aberta_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`encerrada_em` datetime,
	`total_consultas` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `clinical_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conduct_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`soap_note_id` int NOT NULL,
	`medico_id` int NOT NULL,
	`diagnostico` varchar(255),
	`cid10` varchar(10),
	`nivel_urgencia` varchar(10) NOT NULL,
	`hash_alerta` varchar(128),
	`alerta_json` json NOT NULL,
	`mensagem_medico` text,
	`visto_por_id` int,
	`visto_em` datetime,
	`supressao_ate` datetime,
	`feedback_medico` varchar(20),
	`feedback_motivo` text,
	`feedback_em` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `conduct_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `publication_drafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`medico_id` int NOT NULL,
	`tipo` varchar(20) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'rascunho',
	`titulo` text,
	`diagnostico` varchar(255),
	`cid10` varchar(10),
	`n_casos` int DEFAULT 0,
	`soap_note_ids` json,
	`tema` varchar(255),
	`n_artigos` int DEFAULT 0,
	`jornal` varchar(255),
	`doi` varchar(255),
	`data_submissao` datetime,
	`data_publicacao` datetime,
	`texto_gerado` longtext,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`atualizado_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `publication_drafts_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_pdrafts_uniq_cid10` UNIQUE(`medico_id`,`tipo`,`cid10`,`status`)
);
--> statement-breakpoint
CREATE TABLE `soap_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` int NOT NULL,
	`medico_id` int NOT NULL,
	`paciente_nome_encrypted` text NOT NULL,
	`template` varchar(50) NOT NULL DEFAULT 'infectologia_geral',
	`soap_texto` text NOT NULL,
	`knowledge_metadata` json,
	`diagnostico_principal` varchar(255),
	`cid10` varchar(10),
	`certeza` varchar(20),
	`pubmed_query` text,
	`sintese_evidencias` text,
	`evidence_metadata` json,
	`retencao_ate` datetime NOT NULL DEFAULT DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 20 YEAR),
	`deleted_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `soap_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`open_id` varchar(255) NOT NULL,
	`email` varchar(255),
	`nome` varchar(255),
	`role` varchar(50) NOT NULL DEFAULT 'medico',
	`ativo` boolean NOT NULL DEFAULT true,
	`totp_enabled` boolean NOT NULL DEFAULT false,
	`deleted_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_users_open_id` UNIQUE(`open_id`)
);
--> statement-breakpoint
ALTER TABLE `clinical_digests` ADD CONSTRAINT `clinical_digests_medico_id_users_id_fk` FOREIGN KEY (`medico_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clinical_sessions` ADD CONSTRAINT `clinical_sessions_medico_id_users_id_fk` FOREIGN KEY (`medico_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conduct_alerts` ADD CONSTRAINT `conduct_alerts_soap_note_id_soap_notes_id_fk` FOREIGN KEY (`soap_note_id`) REFERENCES `soap_notes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conduct_alerts` ADD CONSTRAINT `conduct_alerts_medico_id_users_id_fk` FOREIGN KEY (`medico_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conduct_alerts` ADD CONSTRAINT `conduct_alerts_visto_por_id_users_id_fk` FOREIGN KEY (`visto_por_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `publication_drafts` ADD CONSTRAINT `publication_drafts_medico_id_users_id_fk` FOREIGN KEY (`medico_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `soap_notes` ADD CONSTRAINT `soap_notes_session_id_clinical_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `clinical_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `soap_notes` ADD CONSTRAINT `soap_notes_medico_id_users_id_fk` FOREIGN KEY (`medico_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_cdigests_medico` ON `clinical_digests` (`medico_id`);--> statement-breakpoint
CREATE INDEX `idx_cdigests_tipo` ON `clinical_digests` (`tipo`);--> statement-breakpoint
CREATE INDEX `idx_csessions_medico` ON `clinical_sessions` (`medico_id`);--> statement-breakpoint
CREATE INDEX `idx_csessions_aberta` ON `clinical_sessions` (`aberta_em`);--> statement-breakpoint
CREATE INDEX `idx_calerts_soap` ON `conduct_alerts` (`soap_note_id`);--> statement-breakpoint
CREATE INDEX `idx_calerts_medico` ON `conduct_alerts` (`medico_id`);--> statement-breakpoint
CREATE INDEX `idx_calerts_urgencia` ON `conduct_alerts` (`nivel_urgencia`);--> statement-breakpoint
CREATE INDEX `idx_calerts_visto` ON `conduct_alerts` (`visto_em`);--> statement-breakpoint
CREATE INDEX `idx_calerts_hash` ON `conduct_alerts` (`hash_alerta`);--> statement-breakpoint
CREATE INDEX `idx_calerts_feedback` ON `conduct_alerts` (`feedback_medico`);--> statement-breakpoint
CREATE INDEX `idx_pdrafts_medico` ON `publication_drafts` (`medico_id`);--> statement-breakpoint
CREATE INDEX `idx_pdrafts_status` ON `publication_drafts` (`status`);--> statement-breakpoint
CREATE INDEX `idx_pdrafts_cid10` ON `publication_drafts` (`cid10`);--> statement-breakpoint
CREATE INDEX `idx_soap_session` ON `soap_notes` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_soap_medico` ON `soap_notes` (`medico_id`);--> statement-breakpoint
CREATE INDEX `idx_soap_cid10` ON `soap_notes` (`cid10`);--> statement-breakpoint
CREATE INDEX `idx_soap_created` ON `soap_notes` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_users_role` ON `users` (`role`);
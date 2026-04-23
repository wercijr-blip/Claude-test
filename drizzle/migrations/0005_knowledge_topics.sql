-- Migration: 0005_knowledge_topics.sql
-- Creates knowledge_topics table for MedScribe

CREATE TABLE IF NOT EXISTS knowledge_topics (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  topic             VARCHAR(500) NOT NULL,
  pubmedQuery       TEXT,
  source            ENUM('auto', 'manual') NOT NULL DEFAULT 'auto',
  status            ENUM('pending', 'sent', 'done') NOT NULL DEFAULT 'pending',
  consultationId    INT,
  clinicId          VARCHAR(21),
  visibility        ENUM('clinic') NOT NULL DEFAULT 'clinic',
  sharedBy          INT,
  medicalSpecialty  VARCHAR(100),
  specialtyCategory VARCHAR(50),
  subtopics         TEXT,
  createdAt         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_kt_clinic    (clinicId),
  INDEX idx_kt_status    (status),
  INDEX idx_kt_shared_by (sharedBy)
) CHARACTER SET utf8mb4;

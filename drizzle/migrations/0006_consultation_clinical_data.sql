-- Migration: 0006_consultation_clinical_data.sql
-- Creates consultations and consultation_clinical_data tables

CREATE TABLE IF NOT EXISTS consultations (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  userId          INT NOT NULL,
  patientName     VARCHAR(255),
  patientAge      INT,
  chiefComplaint  TEXT,
  audioUrl        VARCHAR(1000),
  audioDuration   INT,
  transcription   TEXT,
  soapSubjective  TEXT,
  soapObjective   TEXT,
  soapAssessment  TEXT,
  soapPlan        TEXT,
  qualityScore    INT,
  status          VARCHAR(50) NOT NULL DEFAULT 'draft',
  exportedAt      DATETIME,
  createdAt       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_consultations_user    (userId),
  INDEX idx_consultations_status  (status),
  INDEX idx_consultations_created (createdAt)
) CHARACTER SET utf8mb4;

CREATE TABLE IF NOT EXISTS consultation_clinical_data (
  id                           VARCHAR(21)  PRIMARY KEY,
  consultation_id              INT          NOT NULL,
  doctor_id                    INT          NOT NULL,
  clinic_id                    VARCHAR(21),
  exams_requested              TEXT,
  treatment_type               ENUM('oral','iv','both','none'),
  medications                  TEXT,
  has_hospitalization_indication INT,
  follow_up_days               INT,
  createdAt                    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ccd_consultation (consultation_id),
  INDEX idx_ccd_doctor       (doctor_id),
  INDEX idx_ccd_clinic       (clinic_id)
) CHARACTER SET utf8mb4;

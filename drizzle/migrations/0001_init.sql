-- MedScrita — Migration inicial
-- Cria todas as tabelas do zero

CREATE TABLE IF NOT EXISTS users (
  id                     INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email                  VARCHAR(320) NOT NULL,
  passwordHash           VARCHAR(255),
  name                   VARCHAR(255),
  role                   ENUM('admin','doctor') NOT NULL DEFAULT 'doctor',
  clinicId               VARCHAR(21),
  specialty              VARCHAR(100),
  crm                    VARCHAR(30),
  active                 INT          NOT NULL DEFAULT 1,
  mustChangePassword     INT          NOT NULL DEFAULT 1,
  bulletinEmail          VARCHAR(320),
  receiveMonthlyBulletin INT          NOT NULL DEFAULT 1,
  createdAt              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_users_email  (email),
  INDEX      idx_users_clinic (clinicId),
  INDEX      idx_users_role   (role)
);

CREATE TABLE IF NOT EXISTS consultations (
  id             INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  userId         INT           NOT NULL,
  patientName    VARCHAR(255),
  patientAge     INT,
  chiefComplaint TEXT,
  audioUrl       VARCHAR(1000),
  audioDuration  INT,
  transcription  TEXT,
  soapSubjective TEXT,
  soapObjective  TEXT,
  soapAssessment TEXT,
  soapPlan       TEXT,
  qualityScore   INT,
  status         VARCHAR(50)   NOT NULL DEFAULT 'draft',
  exportedAt     DATETIME,
  createdAt      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_consultations_user    (userId),
  INDEX idx_consultations_status  (status),
  INDEX idx_consultations_created (createdAt)
);

CREATE TABLE IF NOT EXISTS knowledge_topics (
  id                INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  topic             VARCHAR(500) NOT NULL,
  pubmedQuery       TEXT,
  source            ENUM('auto','manual') NOT NULL DEFAULT 'auto',
  status            ENUM('pending','sent','done') NOT NULL DEFAULT 'pending',
  consultationId    INT,
  clinicId          VARCHAR(21),
  visibility        ENUM('clinic') NOT NULL DEFAULT 'clinic',
  sharedBy          INT,
  medicalSpecialty  VARCHAR(100),
  specialtyCategory VARCHAR(50),
  subtopics         TEXT,
  createdAt         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_kt_clinic    (clinicId),
  INDEX idx_kt_status    (status),
  INDEX idx_kt_shared_by (sharedBy)
);

CREATE TABLE IF NOT EXISTS consultation_clinical_data (
  id                           VARCHAR(21)                      NOT NULL PRIMARY KEY,
  consultation_id              INT                              NOT NULL,
  doctor_id                    INT                              NOT NULL,
  clinic_id                    VARCHAR(21),
  exams_requested              TEXT,
  treatment_type               ENUM('oral','iv','both','none'),
  medications                  TEXT,
  has_hospitalization_indication INT,
  follow_up_days               INT,
  createdAt                    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ccd_consultation (consultation_id),
  INDEX idx_ccd_doctor       (doctor_id),
  INDEX idx_ccd_clinic       (clinic_id)
);

CREATE TABLE IF NOT EXISTS bulletin_history (
  id           INT         NOT NULL AUTO_INCREMENT PRIMARY KEY,
  clinicId     VARCHAR(21) NOT NULL,
  month        VARCHAR(7)  NOT NULL,
  doctorCount  INT         NOT NULL DEFAULT 0,
  articleCount INT         NOT NULL DEFAULT 0,
  sentBy       INT         NOT NULL,
  resentAt     DATETIME,
  createdAt    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bh_clinic (clinicId),
  INDEX idx_bh_month  (month)
);

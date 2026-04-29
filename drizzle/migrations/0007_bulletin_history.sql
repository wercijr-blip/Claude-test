CREATE TABLE IF NOT EXISTS bulletin_history (
  id           INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  clinicId     VARCHAR(21)  NOT NULL,
  month        VARCHAR(7)   NOT NULL,
  doctorCount  INT          NOT NULL DEFAULT 0,
  articleCount INT          NOT NULL DEFAULT 0,
  sentBy       INT          NOT NULL,
  resentAt     DATETIME     NULL,
  createdAt    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bh_clinic (clinicId),
  INDEX idx_bh_month  (month)
);

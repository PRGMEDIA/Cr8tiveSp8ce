-- ============================================================
-- Aura Atelier — Database schema v1 (MySQL 5.7+/8.0, InnoDB)
-- Hosting: 50.6.35.211 (cPanel, docroot /home1/hoeirpte/public_html)
-- Engine note: password hashes are SHA-256(salt:password) hex —
--   the same WebCrypto scheme the front end uses, so server-side
--   validation (SW-VAL-1) compares like-for-like.
-- Run this AFTER creating the database + user in cPanel.
-- ============================================================

-- Members — the only table that may hold superuser flags (SW-SUPER-1).
-- is_super is set ONLY by the owner (directly or via the Admin Agent
-- once it is wired to the server). Never auto-assigned.
CREATE TABLE IF NOT EXISTS aura_members (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_id     VARCHAR(64)  NOT NULL,
  pw_hash       CHAR(64)     NOT NULL,                -- SHA-256 hex
  salt          VARCHAR(64)  NOT NULL,
  phone         VARCHAR(32)  DEFAULT NULL,            -- optional (Phase III)
  is_super      TINYINT(1)   NOT NULL DEFAULT 0,      -- owner-assigned only
  recovery_hash CHAR(64)     DEFAULT NULL,            -- recovery code, hashed
  ip_ack        TINYINT(1)   NOT NULL DEFAULT 0,      -- IP acknowledgment done
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_member (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Invite codes — minted by a superuser, shown once, stored hashed.
CREATE TABLE IF NOT EXISTS aura_invites (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code_hash   CHAR(64)     NOT NULL,
  used_by     VARCHAR(64)  DEFAULT NULL,             -- member_id that consumed it
  used_at     TIMESTAMP    NULL DEFAULT NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Super transfer grants — one-time owner-issued promotion codes.
CREATE TABLE IF NOT EXISTS aura_super_grants (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code_hash   CHAR(64)     NOT NULL,
  used_by     VARCHAR(64)  DEFAULT NULL,
  used_at     TIMESTAMP    NULL DEFAULT NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Designs — drafts / complete / trash (mirrors the Project Library).
CREATE TABLE IF NOT EXISTS aura_designs (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_id   VARCHAR(64)  NOT NULL,
  name        VARCHAR(120) NOT NULL,
  state       ENUM('draft','complete','trash') NOT NULL DEFAULT 'draft',
  data        MEDIUMTEXT,                            -- project JSON
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_member_state (member_id, state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Media — images/video/audio bytes (LONGBLOB) or S3-compatible object keys.
-- When object storage is attached, data stays NULL and object_key is set.
CREATE TABLE IF NOT EXISTS aura_media (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_id   VARCHAR(64)  NOT NULL,
  name        VARCHAR(160) NOT NULL,
  mime        VARCHAR(80)  NOT NULL,
  kind        ENUM('image','video','audio','template') NOT NULL,
  object_key  VARCHAR(255) DEFAULT NULL,             -- S3-compatible bucket key
  data        LONGBLOB       DEFAULT NULL,           -- inline bytes until buckets attach
  by_name     VARCHAR(64)  DEFAULT NULL,            -- community attribution
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_member (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Audit log — ISO 27001:2022 aligned (A.8.15 logging, A.8.16 monitoring,
-- 5.33/5.34 record protection & retention).
-- Every auth/validation event the back end accepts or rejects is recorded
-- (SW-VAL-1: the back end is the source of truth; it logs what it sees).
--
-- Controls implemented at schema level:
--   * Tamper evidence: hash-chained rows (prev_hash + row_hash). Any edit or
--     deletion breaks the chain and is detectable by the audit-verify routine.
--   * Append-only: the application DB user receives INSERT/SELECT only on this
--     table — no UPDATE, no DELETE (enforced at the cPanel privilege step).
--   * Retention: retention_until set per event class at insert time.
--   * No secrets: detail carries identifiers only — never passwords, tokens,
--     or full personal data (data-minimization, ISO 27001 5.34).
--   * Clock: occurred_utc is UTC; host clock must sync to NTP (A.8.17).
CREATE TABLE IF NOT EXISTS aura_audit_log (
  seq            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id       CHAR(36)     NOT NULL,               -- UUID per event
  occurred_utc   DATETIME(3)  NOT NULL,               -- UTC, recorded at event time
  event_type     VARCHAR(48)  NOT NULL,               -- controlled vocabulary:
                                                     --   sign_in_ok | sign_in_fail | member_created |
                                                     --   member_deleted | password_reset | invite_issued |
                                                     --   invite_used | invite_rejected | super_granted |
                                                     --   export_ok | export_fail | validation_rejected |
                                                     --   config_changed | db_error
  outcome        ENUM('success','failure','denied') NOT NULL,
  severity       ENUM('info','notice','warning','alert') NOT NULL DEFAULT 'info',
  actor          VARCHAR(64)  DEFAULT NULL,           -- member_id (NULL = anonymous)
  actor_role     ENUM('member','superuser','owner','system') DEFAULT 'member',
  object         VARCHAR(160) DEFAULT NULL,           -- resource acted upon (design id, file name)
  detail         VARCHAR(512) DEFAULT NULL,           -- identifiers only — no credentials/PII
  source_ip      VARBINARY(16) DEFAULT NULL,
  user_agent     VARCHAR(255) DEFAULT NULL,
  correlation_id CHAR(36)     DEFAULT NULL,           -- groups a session/action chain
  prev_hash      CHAR(64)     NOT NULL DEFAULT '',    -- hash of the previous entry
  row_hash       CHAR(64)     NOT NULL,               -- SHA-256 over the canonical row fields
  retention_until DATE        NOT NULL,               -- ISO 27001 5.33 retention date
  KEY idx_actor_time (actor, occurred_utc),
  KEY idx_type_time  (event_type, occurred_utc),
  KEY idx_corr (correlation_id),
  KEY idx_sev (severity, occurred_utc)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Migration: Add organization_id to audit_logs for superadmin tracking
-- File: 005_audit_logs_organization_id.sql
-- Run this once to update the schema
-- ============================================================

-- Add organization_id column to audit_logs if it doesn't exist
ALTER TABLE IF EXISTS audit_logs 
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id 
  ON audit_logs(organization_id);

-- Create composite index for queries by user + org
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_org 
  ON audit_logs(user_id, organization_id);

-- Create index for action + date (useful for audit queries)
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_date 
  ON audit_logs(action, created_at DESC);

-- ============================================================
-- Test queries after migration
-- ============================================================

-- Check all SUPERADMIN accesses
-- SELECT user_id, action, organization_id, created_at FROM audit_logs
-- WHERE action LIKE 'SUPERADMIN%'
-- ORDER BY created_at DESC
-- LIMIT 50;

-- Check specific org accesses
-- SELECT user_id, action, resource_type, created_at FROM audit_logs
-- WHERE organization_id = 'YOUR_ORG_ID'
-- ORDER BY created_at DESC
-- LIMIT 50;

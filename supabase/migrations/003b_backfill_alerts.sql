-- ═══════════════════════════════════════════════════════════════════
-- Phase 5 — Backfill Existing Alerts
-- ═══════════════════════════════════════════════════════════════════

-- 1. Backfill file events (all existing rows)
INSERT INTO public.alerts (company_id, source_table, source_event_id, 
  severity, title, description, status, created_at)
SELECT
  company_id,
  'wpshield_events_file',
  id,
  severity,
  CASE event
    WHEN 'file_modified' THEN 'File modified: ' || COALESCE(path, 'unknown path')
    WHEN 'file_added'    THEN 'New file detected: ' || COALESCE(path, 'unknown path')
    WHEN 'file_deleted'  THEN 'File deleted: ' || COALESCE(path, 'unknown path')
    ELSE 'File change detected: ' || COALESCE(path, 'unknown path')
  END as title,
  CASE event
    WHEN 'file_modified' THEN 
      'A PHP file was changed on your site. File: ' || COALESCE(path, 'unknown') || 
      '. Size: ' || COALESCE(ROUND(size::numeric/1024, 1)::text, '?') || ' KB. ' ||
      'This could indicate a plugin update, theme change, or unauthorized modification. ' ||
      'Please review if this was expected.'
    WHEN 'file_added' THEN
      'A new PHP file appeared on your site that was not there before. File: ' || 
      COALESCE(path, 'unknown') || 
      '. Size: ' || COALESCE(ROUND(size::numeric/1024, 1)::text, '?') || ' KB. ' ||
      'Unexpected new files can be a sign of a hack or malware injection. ' ||
      'Please verify this file is legitimate.'
    WHEN 'file_deleted' THEN
      'A PHP file that existed on your site has been removed. File: ' || 
      COALESCE(path, 'unknown') || 
      '. If you did not intentionally delete this file, investigate immediately.'
    ELSE 'A file change was detected on your site.'
  END as description,
  'open' as status,
  occurred_at as created_at
FROM public.wpshield_events_file
WHERE NOT EXISTS (
  SELECT 1 FROM public.alerts a 
  WHERE a.source_table = 'wpshield_events_file' 
  AND a.source_event_id = wpshield_events_file.id
);

-- 2. Backfill attack events (high/critical only)
INSERT INTO public.alerts (company_id, source_table, source_event_id,
  severity, title, description, status, created_at)
SELECT
  company_id,
  'wpshield_events_attack',
  id,
  severity,
  CASE pattern_type
    WHEN 'sqli'          THEN 'SQL Injection attempt detected'
    WHEN 'xss'           THEN 'Cross-site scripting (XSS) attempt detected'
    WHEN 'lfi'           THEN 'Local file inclusion attempt detected'
    WHEN 'rce'           THEN 'Remote code execution attempt detected'
    WHEN 'wpscan_ua'     THEN 'Security scanner detected'
    WHEN 'sensitive_404' THEN 'Sensitive file probe detected'
    WHEN 'xmlrpc_call'   THEN 'XML-RPC abuse detected'
    ELSE                      'Attack attempt detected'
  END as title,
  CASE pattern_type
    WHEN 'sqli' THEN
      'Someone tried to inject malicious SQL code into your website from IP address ' || 
      COALESCE(ip, 'unknown') || '. This is a common hacking technique used to steal ' ||
      'or destroy database content. The request was logged but not blocked — consider adding a firewall.'
    WHEN 'xss' THEN
      'A cross-site scripting attack was detected from IP ' || COALESCE(ip, 'unknown') || 
      '. The attacker tried to inject malicious scripts into your website pages, ' ||
      'which could be used to steal visitor data.'
    WHEN 'lfi' THEN
      'An attempt was made from IP ' || COALESCE(ip, 'unknown') || 
      ' to access restricted files on your server. This technique is used by ' ||
      'attackers to read sensitive configuration files.'
    WHEN 'rce' THEN
      'A remote code execution attempt was detected from IP ' || COALESCE(ip, 'unknown') || 
      '. This is one of the most serious attack types — the attacker tried to run ' ||
      'commands directly on your server.'
    WHEN 'wpscan_ua' THEN
      'A known security scanning tool was detected accessing your site from IP ' || 
      COALESCE(ip, 'unknown') || '. Attackers use these tools to find vulnerabilities ' ||
      'before launching an attack.'
    WHEN 'sensitive_404' THEN
      'Someone probed your site for sensitive files (such as configuration files or admin panels) from IP ' || 
      COALESCE(ip, 'unknown') || '. This is often the first step before a targeted attack.'
    WHEN 'xmlrpc_call' THEN
      'Your site''s XML-RPC endpoint is being accessed from IP ' || COALESCE(ip, 'unknown') || 
      '. This endpoint is commonly abused for brute force attacks and spam. ' ||
      'Consider disabling XML-RPC if you don''t use it.'
    ELSE
      'A security attack attempt was detected on your site from IP ' || 
      COALESCE(ip, 'unknown') || '.'
  END as description,
  'open' as status,
  occurred_at as created_at
FROM public.wpshield_events_attack
WHERE severity IN ('high', 'critical')
AND NOT EXISTS (
  SELECT 1 FROM public.alerts a 
  WHERE a.source_table = 'wpshield_events_attack' 
  AND a.source_event_id = wpshield_events_attack.id
);

-- 3. Backfill role escalation events
INSERT INTO public.alerts (company_id, source_table, source_event_id,
  severity, title, description, status, created_at)
SELECT
  company_id,
  'wpshield_events_login',
  id,
  'critical',
  'Admin privileges granted to ' || COALESCE(login, 'unknown user'),
  'The user ''' || COALESCE(login, 'unknown') || ''' on your site has been given administrator access. ' ||
  'Administrators have full control over your WordPress site including installing plugins, changing themes, and accessing all content. ' ||
  'If you did not authorize this change, take immediate action.',
  'open',
  occurred_at
FROM public.wpshield_events_login
WHERE event = 'role_changed'
AND roles_json::text LIKE '%administrator%'
AND NOT EXISTS (
  SELECT 1 FROM public.alerts a 
  WHERE a.source_table = 'wpshield_events_login' 
  AND a.source_event_id = wpshield_events_login.id
);

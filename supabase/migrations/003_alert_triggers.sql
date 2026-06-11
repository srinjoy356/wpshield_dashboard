-- ═══════════════════════════════════════════════════════════════════
-- Phase 5 — Alert Generation Triggers
-- ═══════════════════════════════════════════════════════════════════

-- 1. File Integrity Alert Function
CREATE OR REPLACE FUNCTION public.create_alert_from_file_event()
RETURNS TRIGGER AS $$
DECLARE
    v_title TEXT;
    v_desc TEXT;
BEGIN
    -- Determine Title
    v_title := CASE NEW.event
        WHEN 'file_modified' THEN 'File modified: ' || COALESCE(NEW.path, 'unknown path')
        WHEN 'file_added'    THEN 'New file detected: ' || COALESCE(NEW.path, 'unknown path')
        WHEN 'file_deleted'  THEN 'File deleted: ' || COALESCE(NEW.path, 'unknown path')
        ELSE 'File change detected: ' || COALESCE(NEW.path, 'unknown path')
    END;

    -- Determine Description
    v_desc := CASE NEW.event
        WHEN 'file_modified' THEN 
            'A PHP file was changed on your site. File: ' || COALESCE(NEW.path, 'unknown') || 
            '. Size: ' || COALESCE(ROUND(NEW.size::numeric/1024, 1)::text, '?') || ' KB. ' ||
            'This could indicate a plugin update, theme change, or unauthorized modification. ' ||
            'Please review if this was expected.'
        WHEN 'file_added' THEN
            'A new PHP file appeared on your site that was not there before. File: ' || 
            COALESCE(NEW.path, 'unknown') || 
            '. Size: ' || COALESCE(ROUND(NEW.size::numeric/1024, 1)::text, '?') || ' KB. ' ||
            'Unexpected new files can be a sign of a hack or malware injection. ' ||
            'Please verify this file is legitimate.'
        WHEN 'file_deleted' THEN
            'A PHP file that existed on your site has been removed. File: ' || 
            COALESCE(NEW.path, 'unknown') || 
            '. If you did not intentionally delete this file, investigate immediately.'
        ELSE 'A file change was detected on your site.'
    END;

    INSERT INTO public.alerts (
        company_id, 
        source_table, 
        source_event_id, 
        severity, 
        title, 
        description, 
        status
    ) VALUES (
        NEW.company_id,
        'wpshield_events_file',
        NEW.id,
        NEW.severity,
        v_title,
        v_desc,
        'open'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attack Event Alert Function
CREATE OR REPLACE FUNCTION public.create_alert_from_attack_event()
RETURNS TRIGGER AS $$
DECLARE
    v_title TEXT;
    v_desc TEXT;
BEGIN
    -- Only alert on High or Critical
    IF NEW.severity NOT IN ('high', 'critical') THEN
        RETURN NEW;
    END IF;

    -- Determine Title
    v_title := CASE NEW.pattern_type
        WHEN 'sqli'          THEN 'SQL Injection attempt detected'
        WHEN 'xss'           THEN 'Cross-site scripting (XSS) attempt detected'
        WHEN 'lfi'           THEN 'Local file inclusion attempt detected'
        WHEN 'rce'           THEN 'Remote code execution attempt detected'
        WHEN 'wpscan_ua'     THEN 'Security scanner detected'
        WHEN 'sensitive_404' THEN 'Sensitive file probe detected'
        WHEN 'xmlrpc_call'   THEN 'XML-RPC abuse detected'
        ELSE                      'Attack attempt detected'
    END;

    -- Determine Description
    v_desc := CASE NEW.pattern_type
        WHEN 'sqli' THEN
            'Someone tried to inject malicious SQL code into your website from IP address ' || 
            COALESCE(NEW.ip, 'unknown') || '. This is a common hacking technique used to steal ' ||
            'or destroy database content. The request was logged but not blocked — consider adding a firewall.'
        WHEN 'xss' THEN
            'A cross-site scripting attack was detected from IP ' || COALESCE(NEW.ip, 'unknown') || 
            '. The attacker tried to inject malicious scripts into your website pages, ' ||
            'which could be used to steal visitor data.'
        WHEN 'lfi' THEN
            'An attempt was made from IP ' || COALESCE(NEW.ip, 'unknown') || 
            ' to access restricted files on your server. This technique is used by ' ||
            'attackers to read sensitive configuration files.'
        WHEN 'rce' THEN
            'A remote code execution attempt was detected from IP ' || COALESCE(NEW.ip, 'unknown') || 
            '. This is one of the most serious attack types — the attacker tried to run ' ||
            'commands directly on your server.'
        WHEN 'wpscan_ua' THEN
            'A known security scanning tool was detected accessing your site from IP ' || 
            COALESCE(NEW.ip, 'unknown') || '. Attackers use these tools to find vulnerabilities ' ||
            'before launching an attack.'
        WHEN 'sensitive_404' THEN
            'Someone probed your site for sensitive files (such as configuration files or admin panels) from IP ' || 
            COALESCE(NEW.ip, 'unknown') || '. This is often the first step before a targeted attack.'
        WHEN 'xmlrpc_call' THEN
            'Your site''s XML-RPC endpoint is being accessed from IP ' || COALESCE(NEW.ip, 'unknown') || 
            '. This endpoint is commonly abused for brute force attacks and spam. ' ||
            'Consider disabling XML-RPC if you don''t use it.'
        ELSE
            'A security attack attempt was detected on your site from IP ' || 
            COALESCE(NEW.ip, 'unknown') || '.'
    END;

    INSERT INTO public.alerts (
        company_id, 
        source_table, 
        source_event_id, 
        severity, 
        title, 
        description, 
        status
    ) VALUES (
        NEW.company_id,
        'wpshield_events_attack',
        NEW.id,
        NEW.severity,
        v_title,
        v_desc,
        'open'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Login Event Alert Function (Role Escalation & Brute Force)
CREATE OR REPLACE FUNCTION public.create_alert_from_login_event()
RETURNS TRIGGER AS $$
DECLARE
    v_fail_count INT;
    v_existing_alert_id BIGINT;
BEGIN
    -- CASE A: Role changed to administrator
    IF NEW.event = 'role_changed' AND NEW.roles_json::text LIKE '%administrator%' THEN
        INSERT INTO public.alerts (
            company_id, 
            source_table, 
            source_event_id, 
            severity, 
            title, 
            description, 
            status
        ) VALUES (
            NEW.company_id,
            'wpshield_events_login',
            NEW.id,
            'critical',
            'Admin privileges granted to ' || COALESCE(NEW.login, 'unknown user'),
            'The user ''' || COALESCE(NEW.login, 'unknown') || ''' on your site has been given administrator access. ' ||
            'Administrators have full control over your WordPress site including installing plugins, changing themes, and accessing all content. ' ||
            'If you did not authorize this change, take immediate action.',
            'open'
        );
        RETURN NEW;
    END IF;

    -- CASE B: Brute force detection (3+ failed logins from same IP in 10 mins)
    IF NEW.event = 'login_failed' THEN
        -- Count recent failures
        SELECT COUNT(*) INTO v_fail_count
        FROM public.wpshield_events_login
        WHERE event = 'login_failed'
          AND ip = NEW.ip
          AND company_id = NEW.company_id
          AND occurred_at >= NOW() - INTERVAL '10 minutes';

        IF v_fail_count >= 3 THEN
            -- Check for existing open alert for this IP in last 10 min
            SELECT id INTO v_existing_alert_id
            FROM public.alerts
            WHERE title = 'Brute force login attack from ' || NEW.ip
              AND status = 'open'
              AND company_id = NEW.company_id
              AND created_at >= NOW() - INTERVAL '10 minutes'
            LIMIT 1;

            IF v_existing_alert_id IS NULL THEN
                INSERT INTO public.alerts (
                    company_id, 
                    source_table, 
                    source_event_id, 
                    severity, 
                    title, 
                    description, 
                    status
                ) VALUES (
                    NEW.company_id,
                    'wpshield_events_login',
                    NEW.id,
                    'high',
                    'Brute force login attack from ' || NEW.ip,
                    'Your site has received ' || v_fail_count || ' failed login attempts from IP address ' || 
                    NEW.ip || ' in the last 10 minutes. This is a brute force attack — someone is repeatedly ' ||
                    'trying to guess your WordPress password. Consider blocking this IP address.',
                    'open'
                );
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════
-- 4. Triggers
-- ═══════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trigger_alert_file_event ON public.wpshield_events_file;
CREATE TRIGGER trigger_alert_file_event
AFTER INSERT ON public.wpshield_events_file
FOR EACH ROW EXECUTE FUNCTION public.create_alert_from_file_event();

DROP TRIGGER IF EXISTS trigger_alert_attack_event ON public.wpshield_events_attack;
CREATE TRIGGER trigger_alert_attack_event
AFTER INSERT ON public.wpshield_events_attack
FOR EACH ROW EXECUTE FUNCTION public.create_alert_from_attack_event();

DROP TRIGGER IF EXISTS trigger_alert_login_event ON public.wpshield_events_login;
CREATE TRIGGER trigger_alert_login_event
AFTER INSERT ON public.wpshield_events_login
FOR EACH ROW EXECUTE FUNCTION public.create_alert_from_login_event();

-- ═══════════════════════════════════════════════════════════════════
-- 5. Permissions
-- ═══════════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION public.create_alert_from_file_event() TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.create_alert_from_attack_event() TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.create_alert_from_login_event() TO service_role, authenticated;

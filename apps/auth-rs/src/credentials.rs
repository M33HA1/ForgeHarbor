pub const AUTH_JSON_LIMIT: usize = 8 * 1024;
const MIN_NEW_PASSWORD_CHARS: usize = 15;
const MAX_NEW_PASSWORD_CHARS: usize = 128;
const MAX_LOGIN_PASSWORD_CHARS: usize = 1024;

// Deliberately support ordinary ASCII mailbox addresses. Do not silently
// normalize existing account identities or change password bytes.
fn valid_email(email: &str) -> bool {
    if email.len() > 254 || !email.is_ascii() {
        return false;
    }
    let Some((local, domain)) = email.split_once('@') else {
        return false;
    };
    if local.is_empty()
        || local.len() > 64
        || local.starts_with('.')
        || local.ends_with('.')
        || local.contains("..")
        || !local
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b".!#$%&'*+-/=?^_`{|}~".contains(&byte))
    {
        return false;
    }
    domain.contains('.')
        && domain.split('.').all(|label| {
            !label.is_empty()
                && label.len() <= 63
                && !label.starts_with('-')
                && !label.ends_with('-')
                && label
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
        })
}

pub fn validate_signup(email: &str, password: &str) -> Result<(), &'static str> {
    if !valid_email(email) {
        return Err("Enter a valid email address (up to 254 characters).");
    }
    if !(MIN_NEW_PASSWORD_CHARS..=MAX_NEW_PASSWORD_CHARS).contains(&password.chars().count()) {
        return Err("Use a password with 15 to 128 characters.");
    }
    Ok(())
}

pub fn validate_login(email: &str, password: &str) -> Result<(), &'static str> {
    // New-password policy must not lock out existing shorter passwords.
    if email.is_empty() || email.len() > 254 || password.chars().count() > MAX_LOGIN_PASSWORD_CHARS
    {
        return Err("Invalid login input.");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_malformed_mailboxes_without_normalizing_identity() {
        for email in [
            "",
            "missing-at",
            "@example.invalid",
            "a@@example.invalid",
            "a@localhost",
            "a b@example.invalid",
            ".a@example.invalid",
            "a..b@example.invalid",
            "a@example..invalid",
            "a@-example.invalid",
            "a@example.invalid-",
            "a@example.invalid\n",
        ] {
            assert!(validate_signup(email, "long fixture passphrase").is_err());
        }
        assert!(
            validate_signup(
                "Fixture.User+tag@Example.invalid",
                "long fixture passphrase"
            )
            .is_ok()
        );
        assert!(
            validate_signup(
                &format!("{}@example.invalid", "a".repeat(65)),
                "long fixture passphrase"
            )
            .is_err()
        );
    }

    #[test]
    fn password_limits_count_unicode_characters_and_preserve_spaces() {
        let email = "fixture@example.invalid";
        for password in [
            "".to_string(),
            "a".repeat(14),
            "🛟".repeat(14),
            "a".repeat(129),
        ] {
            assert!(validate_signup(email, &password).is_err());
        }
        for password in [
            "a".repeat(15),
            "a".repeat(128),
            "🛟".repeat(128),
            "a long passphrase with spaces".to_string(),
        ] {
            assert!(validate_signup(email, &password).is_ok());
        }
    }

    #[test]
    fn login_accepts_legacy_short_passwords_but_bounds_work_input() {
        assert!(validate_login("fixture@example.invalid", "short").is_ok());
        assert!(validate_login("fixture@example.invalid", &"a".repeat(1025)).is_err());
        assert!(validate_login(&"a".repeat(255), "short").is_err());
    }
}

use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use uuid::Uuid;

pub fn validate_pin(pin: &str) -> Result<(), String> {
    if !(4..=6).contains(&pin.len()) || !pin.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err("o PIN deve ter de 4 a 6 números".into());
    }
    Ok(())
}

pub fn hash_pin(pin: &str) -> Result<String, String> {
    validate_pin(pin)?;
    let salt = SaltString::encode_b64(Uuid::new_v4().as_bytes())
        .map_err(|_| "não foi possível gerar a proteção do PIN".to_string())?;
    Argon2::default()
        .hash_password(pin.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|_| "não foi possível proteger o PIN".to_string())
}

pub fn verify_pin(pin_hash: &str, pin: &str) -> bool {
    if validate_pin(pin).is_err() {
        return false;
    }
    PasswordHash::new(pin_hash).ok().is_some_and(|parsed| {
        Argon2::default()
            .verify_password(pin.as_bytes(), &parsed)
            .is_ok()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_and_hashes_numeric_pins() {
        assert!(validate_pin("1234").is_ok());
        assert!(validate_pin("123456").is_ok());
        assert!(validate_pin("123").is_err());
        assert!(validate_pin("12a4").is_err());
        let hash = hash_pin("482951").unwrap();
        assert_ne!(hash, "482951");
        assert!(verify_pin(&hash, "482951"));
        assert!(!verify_pin(&hash, "482950"));
    }
}

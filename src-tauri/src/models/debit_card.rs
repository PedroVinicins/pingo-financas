use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CardNetwork {
    Visa,
    Mastercard,
    Elo,
    Other,
}

impl CardNetwork {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Visa => "visa",
            Self::Mastercard => "mastercard",
            Self::Elo => "elo",
            Self::Other => "other",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "visa" => Some(Self::Visa),
            "mastercard" => Some(Self::Mastercard),
            "elo" => Some(Self::Elo),
            "other" => Some(Self::Other),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CardPattern {
    Soft,
    Waves,
    Dots,
    Grid,
    Aurora,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CardBackground {
    None,
    Amazonia,
    Praia,
    Cidade,
    Montanhas,
}

impl CardBackground {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::Amazonia => "amazonia",
            Self::Praia => "praia",
            Self::Cidade => "cidade",
            Self::Montanhas => "montanhas",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "none" => Some(Self::None),
            "amazonia" => Some(Self::Amazonia),
            "praia" => Some(Self::Praia),
            "cidade" => Some(Self::Cidade),
            "montanhas" => Some(Self::Montanhas),
            _ => None,
        }
    }
}

impl CardPattern {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Soft => "soft",
            Self::Waves => "waves",
            Self::Dots => "dots",
            Self::Grid => "grid",
            Self::Aurora => "aurora",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "soft" => Some(Self::Soft),
            "waves" => Some(Self::Waves),
            "dots" => Some(Self::Dots),
            "grid" => Some(Self::Grid),
            "aurora" => Some(Self::Aurora),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DebitCard {
    pub id: Uuid,
    pub name: String,
    pub issuer: String,
    pub holder_name: String,
    pub last_four: String,
    pub network: CardNetwork,
    pub color_from: String,
    pub color_to: String,
    pub pattern: CardPattern,
    pub background_image: CardBackground,
    pub emoji: Option<String>,
    pub is_default: bool,
    pub is_frozen: bool,
    #[serde(with = "rust_decimal::serde::str_option")]
    pub monthly_spending_limit: Option<Decimal>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewDebitCard {
    pub name: String,
    pub issuer: String,
    pub holder_name: String,
    pub last_four: String,
    pub network: CardNetwork,
    pub color_from: String,
    pub color_to: String,
    pub pattern: CardPattern,
    pub background_image: CardBackground,
    pub emoji: Option<String>,
    pub is_default: bool,
    #[serde(with = "rust_decimal::serde::str_option")]
    pub monthly_spending_limit: Option<Decimal>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDebitCardStyle {
    pub id: Uuid,
    pub color_from: String,
    pub color_to: String,
    pub pattern: CardPattern,
    pub background_image: CardBackground,
    pub emoji: Option<String>,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum DebitCardError {
    #[error("o nome do cartão não pode ficar vazio")]
    EmptyName,
    #[error("o nome do banco não pode ficar vazio")]
    EmptyIssuer,
    #[error("o nome do titular não pode ficar vazio")]
    EmptyHolder,
    #[error("informe exatamente os 4 últimos dígitos do cartão")]
    InvalidLastFour,
    #[error("a cor deve estar no formato hexadecimal #RRGGBB")]
    InvalidColor,
    #[error("o limite mensal precisa ser maior que zero")]
    NonPositiveLimit,
    #[error("o emoji do cartão é muito longo")]
    EmojiTooLong,
}

impl DebitCard {
    pub fn new(input: NewDebitCard) -> Result<Self, DebitCardError> {
        validate_new_debit_card(&input)?;

        Ok(Self {
            id: Uuid::new_v4(),
            name: input.name.trim().to_owned(),
            issuer: input.issuer.trim().to_owned(),
            holder_name: input.holder_name.trim().to_owned(),
            last_four: input.last_four,
            network: input.network,
            color_from: input.color_from.to_ascii_uppercase(),
            color_to: input.color_to.to_ascii_uppercase(),
            pattern: input.pattern,
            background_image: input.background_image,
            emoji: clean_emoji(input.emoji)?,
            is_default: input.is_default,
            is_frozen: false,
            monthly_spending_limit: input.monthly_spending_limit,
            created_at: Utc::now(),
        })
    }
}

pub fn validate_new_debit_card(input: &NewDebitCard) -> Result<(), DebitCardError> {
    if input.name.trim().is_empty() {
        return Err(DebitCardError::EmptyName);
    }
    if input.issuer.trim().is_empty() {
        return Err(DebitCardError::EmptyIssuer);
    }
    if input.holder_name.trim().is_empty() {
        return Err(DebitCardError::EmptyHolder);
    }
    if input.last_four.len() != 4 || !input.last_four.chars().all(|c| c.is_ascii_digit()) {
        return Err(DebitCardError::InvalidLastFour);
    }
    validate_style(&input.color_from, &input.color_to, input.emoji.as_deref())?;
    if input
        .monthly_spending_limit
        .is_some_and(|value| value <= Decimal::ZERO)
    {
        return Err(DebitCardError::NonPositiveLimit);
    }

    Ok(())
}

pub fn validate_style(
    color_from: &str,
    color_to: &str,
    emoji: Option<&str>,
) -> Result<(), DebitCardError> {
    if !is_hex_color(color_from) || !is_hex_color(color_to) {
        return Err(DebitCardError::InvalidColor);
    }
    if emoji.is_some_and(|value| value.chars().count() > 4) {
        return Err(DebitCardError::EmojiTooLong);
    }
    Ok(())
}

pub fn clean_emoji(emoji: Option<String>) -> Result<Option<String>, DebitCardError> {
    let value = emoji
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty());
    if value
        .as_ref()
        .is_some_and(|value| value.chars().count() > 4)
    {
        return Err(DebitCardError::EmojiTooLong);
    }
    Ok(value)
}

fn is_hex_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value[1..]
            .chars()
            .all(|character| character.is_ascii_hexdigit())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    fn input() -> NewDebitCard {
        NewDebitCard {
            name: "Principal".into(),
            issuer: "Banco Inter".into(),
            holder_name: "Pedro Silva".into(),
            last_four: "4242".into(),
            network: CardNetwork::Mastercard,
            color_from: "#F97316".into(),
            color_to: "#EA580C".into(),
            pattern: CardPattern::Waves,
            background_image: CardBackground::Amazonia,
            emoji: Some("🍊".into()),
            is_default: true,
            monthly_spending_limit: Some(dec!(250.00)),
        }
    }

    #[test]
    fn rejects_sensitive_or_invalid_card_number_input() {
        let mut invalid = input();
        invalid.last_four = "1234567890123456".into();
        assert_eq!(
            DebitCard::new(invalid).unwrap_err(),
            DebitCardError::InvalidLastFour
        );
    }

    #[test]
    fn rejects_non_positive_spending_limit() {
        let mut invalid = input();
        invalid.monthly_spending_limit = Some(Decimal::ZERO);
        assert_eq!(
            DebitCard::new(invalid).unwrap_err(),
            DebitCardError::NonPositiveLimit
        );
    }

    #[test]
    fn accepts_fun_personalization_without_sensitive_data() {
        let card = DebitCard::new(input()).unwrap();
        assert_eq!(card.pattern, CardPattern::Waves);
        assert_eq!(card.background_image, CardBackground::Amazonia);
        assert_eq!(card.emoji.as_deref(), Some("🍊"));
    }
}

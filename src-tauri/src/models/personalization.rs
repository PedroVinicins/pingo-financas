use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

use super::AutomaticReserveMode;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DigitalWalletItemKind {
    Ticket,
    Document,
    QrCode,
    Other,
}

impl DigitalWalletItemKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Ticket => "ticket",
            Self::Document => "document",
            Self::QrCode => "qr_code",
            Self::Other => "other",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "ticket" => Some(Self::Ticket),
            "document" => Some(Self::Document),
            "qr_code" => Some(Self::QrCode),
            "other" => Some(Self::Other),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DigitalWalletItem {
    pub id: Uuid,
    pub kind: DigitalWalletItemKind,
    pub title: String,
    pub issuer: String,
    pub notes: String,
    pub qr_value: Option<String>,
    pub file_name: Option<String>,
    pub mime_type: Option<String>,
    pub file_data_url: Option<String>,
    pub expires_at: Option<NaiveDate>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewDigitalWalletItem {
    pub kind: DigitalWalletItemKind,
    pub title: String,
    pub issuer: String,
    pub notes: String,
    pub qr_value: Option<String>,
    pub file_name: Option<String>,
    pub mime_type: Option<String>,
    pub file_data_url: Option<String>,
    pub expires_at: Option<NaiveDate>,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum DigitalWalletItemError {
    #[error("informe um nome para o item da carteira")]
    EmptyTitle,
    #[error("o nome do item deve ter no máximo 100 caracteres")]
    TitleTooLong,
    #[error("o emissor deve ter no máximo 100 caracteres")]
    IssuerTooLong,
    #[error("as observações devem ter no máximo 500 caracteres")]
    NotesTooLong,
    #[error("o conteúdo do QR Code deve ter no máximo 2.000 caracteres")]
    QrValueTooLong,
    #[error("o arquivo ultrapassa o limite local de 3 MB")]
    FileTooLarge,
    #[error("tipo de arquivo não permitido; use imagem ou PDF")]
    UnsupportedFileType,
    #[error("conteúdo do arquivo inválido")]
    InvalidFilePayload,
}

impl DigitalWalletItem {
    pub fn new(input: NewDigitalWalletItem) -> Result<Self, DigitalWalletItemError> {
        validate_wallet_item(&input)?;
        let now = Utc::now();
        Ok(Self {
            id: Uuid::new_v4(),
            kind: input.kind,
            title: input.title.trim().to_owned(),
            issuer: input.issuer.trim().to_owned(),
            notes: input.notes.trim().to_owned(),
            qr_value: clean_optional(input.qr_value),
            file_name: clean_optional(input.file_name),
            mime_type: clean_optional(input.mime_type),
            file_data_url: clean_optional(input.file_data_url),
            expires_at: input.expires_at,
            created_at: now,
            updated_at: now,
        })
    }
}

fn validate_wallet_item(input: &NewDigitalWalletItem) -> Result<(), DigitalWalletItemError> {
    if input.title.trim().is_empty() {
        return Err(DigitalWalletItemError::EmptyTitle);
    }
    if input.title.trim().chars().count() > 100 {
        return Err(DigitalWalletItemError::TitleTooLong);
    }
    if input.issuer.trim().chars().count() > 100 {
        return Err(DigitalWalletItemError::IssuerTooLong);
    }
    if input.notes.trim().chars().count() > 500 {
        return Err(DigitalWalletItemError::NotesTooLong);
    }
    if input
        .qr_value
        .as_ref()
        .is_some_and(|value| value.chars().count() > 2_000)
    {
        return Err(DigitalWalletItemError::QrValueTooLong);
    }
    if input
        .file_data_url
        .as_ref()
        .is_some_and(|value| value.len() > 4_200_000)
    {
        return Err(DigitalWalletItemError::FileTooLarge);
    }
    if input.mime_type.as_ref().is_some_and(|value| {
        !matches!(
            value.as_str(),
            "image/jpeg" | "image/png" | "image/webp" | "application/pdf"
        )
    }) {
        return Err(DigitalWalletItemError::UnsupportedFileType);
    }
    match (&input.mime_type, &input.file_data_url) {
        (Some(mime), Some(data)) if data.starts_with(&format!("data:{mime};base64,")) => {}
        (None, None) => {}
        (Some(_), None) | (None, Some(_)) | (Some(_), Some(_)) => {
            return Err(DigitalWalletItemError::InvalidFilePayload)
        }
    }
    Ok(())
}

fn clean_optional(value: Option<String>) -> Option<String> {
    value
        .map(|item| item.trim().to_owned())
        .filter(|item| !item.is_empty())
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthlyReserveRule {
    pub vault_id: Uuid,
    pub enabled: bool,
    pub mode: AutomaticReserveMode,
    #[serde(with = "rust_decimal::serde::str")]
    pub value: Decimal,
    pub day_of_month: u32,
    pub last_processed_period: Option<String>,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum MonthlyReserveRuleError {
    #[error("o valor da reserva mensal deve ser maior que zero")]
    NonPositiveValue,
    #[error("a porcentagem da reserva mensal deve ficar entre 0% e 100%")]
    InvalidPercentage,
    #[error("escolha um dia entre 1 e 28")]
    InvalidDay,
}

impl MonthlyReserveRule {
    pub fn validate(&self) -> Result<(), MonthlyReserveRuleError> {
        if self.value <= Decimal::ZERO {
            return Err(MonthlyReserveRuleError::NonPositiveValue);
        }
        if self.mode == AutomaticReserveMode::Percentage && self.value > Decimal::from(100u32) {
            return Err(MonthlyReserveRuleError::InvalidPercentage);
        }
        if !(1..=28).contains(&self.day_of_month) {
            return Err(MonthlyReserveRuleError::InvalidDay);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    #[test]
    fn validates_monthly_reserve_day_and_percentage() {
        let rule = MonthlyReserveRule {
            vault_id: Uuid::new_v4(),
            enabled: true,
            mode: AutomaticReserveMode::Percentage,
            value: dec!(10),
            day_of_month: 15,
            last_processed_period: None,
        };
        assert!(rule.validate().is_ok());
        assert_eq!(
            MonthlyReserveRule {
                day_of_month: 31,
                ..rule
            }
            .validate(),
            Err(MonthlyReserveRuleError::InvalidDay)
        );
    }

    #[test]
    fn rejects_disguised_wallet_file_payloads() {
        let input = NewDigitalWalletItem {
            kind: DigitalWalletItemKind::Document,
            title: "Documento".into(),
            issuer: String::new(),
            notes: String::new(),
            qr_value: None,
            file_name: Some("documento.pdf".into()),
            mime_type: Some("application/pdf".into()),
            file_data_url: Some("javascript:alert(1)".into()),
            expires_at: None,
        };
        assert_eq!(
            DigitalWalletItem::new(input),
            Err(DigitalWalletItemError::InvalidFilePayload)
        );
    }
}

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

use super::transaction::TransactionType;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: Uuid,
    pub kind: TransactionType,
    pub name: String,
    pub icon: String,
    pub color: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewCategory {
    pub kind: TransactionType,
    pub name: String,
    pub icon: String,
    pub color: String,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum CategoryError {
    #[error("o nome da categoria não pode ficar vazio")]
    EmptyName,
    #[error("a cor deve estar no formato hexadecimal #RRGGBB")]
    InvalidColor,
}

impl Category {
    pub fn new(input: NewCategory) -> Result<Self, CategoryError> {
        let name = input.name.trim();
        if name.is_empty() {
            return Err(CategoryError::EmptyName);
        }
        if !is_hex_color(&input.color) {
            return Err(CategoryError::InvalidColor);
        }

        Ok(Self {
            id: Uuid::new_v4(),
            kind: input.kind,
            name: name.to_owned(),
            icon: input.icon.trim().to_owned(),
            color: input.color.to_ascii_uppercase(),
            created_at: Utc::now(),
        })
    }
}

fn is_hex_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value[1..].chars().all(|character| character.is_ascii_hexdigit())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_invalid_color() {
        let result = Category::new(NewCategory {
            kind: TransactionType::Expense,
            name: "Casa".into(),
            icon: "house".into(),
            color: "green".into(),
        });

        assert_eq!(result.unwrap_err(), CategoryError::InvalidColor);
    }
}

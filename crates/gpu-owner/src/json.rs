// SPEC: _spec/gpu-owner.md
use crate::{OwnerError, Result};
use serde::de::{DeserializeOwned, DeserializeSeed, MapAccess, SeqAccess, Visitor};
use serde::{Deserialize, Deserializer};
use serde_json::value::RawValue;
use sha2::{Digest, Sha256};
use std::{collections::HashSet, fmt};

pub const SAFE_INTEGER: u64 = 9_007_199_254_740_991;

pub fn sha256(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

pub fn digest(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

pub fn identifier(value: &str, max: usize) -> bool {
    !value.is_empty()
        && value.len() <= max
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"._:-".contains(&b))
}

pub fn decode<'a, T: Deserialize<'a>>(bytes: &'a [u8], bound: usize) -> Result<T> {
    validate(bytes, bound)?;
    serde_json::from_slice(bytes).map_err(|_| OwnerError("JSON_SCHEMA"))
}

pub fn validate(bytes: &[u8], bound: usize) -> Result<()> {
    if bytes.len() > bound || std::str::from_utf8(bytes).is_err() {
        return Err(OwnerError("JSON_BOUND"));
    }
    let mut deserializer = serde_json::Deserializer::from_slice(bytes);
    let mut entries = 0;
    Unique {
        depth: 0,
        entries: &mut entries,
    }
    .deserialize(&mut deserializer)
    .map_err(|_| OwnerError("JSON_UNIQUE"))?;
    deserializer.end().map_err(|_| OwnerError("JSON_TRAILING"))
}

struct Unique<'a> {
    depth: usize,
    entries: &'a mut usize,
}

impl<'de> DeserializeSeed<'de> for Unique<'_> {
    type Value = ();
    fn deserialize<D: Deserializer<'de>>(
        self,
        deserializer: D,
    ) -> std::result::Result<(), D::Error> {
        *self.entries += 1;
        if self.depth > 32 || *self.entries > 16_384 {
            return Err(serde::de::Error::custom("depth"));
        }
        deserializer.deserialize_any(self)
    }
}

impl<'de> Visitor<'de> for Unique<'_> {
    type Value = ();
    fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("bounded unique JSON")
    }
    fn visit_bool<E: serde::de::Error>(self, _: bool) -> std::result::Result<(), E> {
        Ok(())
    }
    fn visit_i64<E: serde::de::Error>(self, value: i64) -> std::result::Result<(), E> {
        if value.unsigned_abs() > SAFE_INTEGER {
            return Err(E::custom("safe integer"));
        }
        Ok(())
    }
    fn visit_u64<E: serde::de::Error>(self, value: u64) -> std::result::Result<(), E> {
        if value > SAFE_INTEGER {
            return Err(E::custom("safe integer"));
        }
        Ok(())
    }
    fn visit_f64<E: serde::de::Error>(self, value: f64) -> std::result::Result<(), E> {
        if !value.is_finite() || (value.fract() == 0.0 && value.abs() > SAFE_INTEGER as f64) {
            return Err(E::custom("safe number"));
        }
        Ok(())
    }
    fn visit_str<E: serde::de::Error>(self, _: &str) -> std::result::Result<(), E> {
        Ok(())
    }
    fn visit_unit<E: serde::de::Error>(self) -> std::result::Result<(), E> {
        Ok(())
    }
    fn visit_none<E: serde::de::Error>(self) -> std::result::Result<(), E> {
        Ok(())
    }
    fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> std::result::Result<(), A::Error> {
        loop {
            let value = seq.next_element_seed(Unique {
                depth: self.depth + 1,
                entries: self.entries,
            })?;
            if value.is_none() {
                return Ok(());
            }
        }
    }
    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> std::result::Result<(), A::Error> {
        let mut seen = HashSet::new();
        while let Some(key) = map.next_key::<String>()? {
            *self.entries += 1;
            if *self.entries > 16_384 || !seen.insert(key) {
                return Err(serde::de::Error::custom("duplicate or entries"));
            }
            map.next_value_seed(Unique {
                depth: self.depth + 1,
                entries: self.entries,
            })?;
        }
        Ok(())
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub struct Decimal(pub i64);

impl serde::Serialize for Decimal {
    fn serialize<S: serde::Serializer>(
        &self,
        serializer: S,
    ) -> std::result::Result<S::Ok, S::Error> {
        if self.0 < 0 {
            return Err(serde::ser::Error::custom("unsigned decimal"));
        }
        serializer.serialize_str(&self.0.to_string())
    }
}

impl<'de> Deserialize<'de> for Decimal {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> std::result::Result<Self, D::Error> {
        let value = String::deserialize(deserializer)?;
        if value.is_empty()
            || value.len() > 19
            || (value.len() > 1 && value.starts_with('0'))
            || !value.bytes().all(|b| b.is_ascii_digit())
        {
            return Err(serde::de::Error::custom("canonical decimal"));
        }
        value
            .parse::<i64>()
            .map(Decimal)
            .map_err(serde::de::Error::custom)
    }
}

pub fn integer<'de, D: Deserializer<'de>, T: DeserializeOwned>(
    deserializer: D,
) -> std::result::Result<T, D::Error> {
    let raw = Box::<RawValue>::deserialize(deserializer)?;
    serde_json::from_str(if raw.get() == "-0" { "0" } else { raw.get() })
        .map_err(serde::de::Error::custom)
}

struct LexicalU32(u32);

impl<'de> Deserialize<'de> for LexicalU32 {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> std::result::Result<Self, D::Error> {
        integer(deserializer).map(Self)
    }
}

pub fn u32_list<'de, D: Deserializer<'de>>(
    deserializer: D,
) -> std::result::Result<Vec<u32>, D::Error> {
    Vec::<LexicalU32>::deserialize(deserializer)
        .map(|values| values.into_iter().map(|value| value.0).collect())
}

pub fn optional_u32<'de, D: Deserializer<'de>>(
    deserializer: D,
) -> std::result::Result<Option<u32>, D::Error> {
    Option::<LexicalU32>::deserialize(deserializer).map(|value| value.map(|value| value.0))
}

pub fn safe_u64<'de, D: Deserializer<'de>>(deserializer: D) -> std::result::Result<u64, D::Error> {
    let value: u64 = integer(deserializer)?;
    if value > SAFE_INTEGER {
        return Err(serde::de::Error::custom("safe integer"));
    }
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Debug, Deserialize, PartialEq)]
    struct U32(#[serde(deserialize_with = "integer")] u32);
    #[derive(Debug, Deserialize, PartialEq)]
    struct I32(#[serde(deserialize_with = "integer")] i32);
    #[derive(Debug, Deserialize, PartialEq)]
    struct U64(#[serde(deserialize_with = "integer")] u64);
    #[derive(Debug, Deserialize, PartialEq)]
    struct SafeU64(#[serde(deserialize_with = "safe_u64")] u64);
    #[derive(Debug, Deserialize, PartialEq)]
    #[serde(deny_unknown_fields)]
    struct Collection {
        #[serde(deserialize_with = "u32_list")]
        values: Vec<u32>,
        #[serde(deserialize_with = "optional_u32")]
        nullable: Option<u32>,
    }

    #[test]
    fn lexical_integer_normalizes_only_the_exact_negative_zero_token() {
        assert_eq!(serde_json::from_str::<U32>("-0").unwrap(), U32(0));
        assert_eq!(serde_json::from_str::<I32>("-0").unwrap(), I32(0));
        assert_eq!(serde_json::from_str::<U64>("-0").unwrap(), U64(0));
        assert_eq!(serde_json::from_str::<I32>("-12").unwrap(), I32(-12));
        for token in [
            "-0.0", "-0e0", "0.0", "0e0", "1.0", "1e0", "true", "null", "\"0\"", "\"-0\"",
        ] {
            assert!(serde_json::from_str::<U32>(token).is_err(), "u32 {token}");
            assert!(serde_json::from_str::<I32>(token).is_err(), "i32 {token}");
            assert!(serde_json::from_str::<U64>(token).is_err(), "u64 {token}");
        }
        assert!(serde_json::from_str::<U32>("-1").is_err());
        assert!(serde_json::from_str::<U64>("-1").is_err());
        assert_eq!(
            serde_json::from_str::<U32>("4294967295").unwrap(),
            U32(u32::MAX)
        );
        assert!(serde_json::from_str::<U32>("4294967296").is_err());
        assert_eq!(
            serde_json::from_str::<I32>("2147483647").unwrap(),
            I32(i32::MAX)
        );
        assert_eq!(
            serde_json::from_str::<I32>("-2147483648").unwrap(),
            I32(i32::MIN)
        );
        assert!(serde_json::from_str::<I32>("2147483648").is_err());
        assert!(serde_json::from_str::<I32>("-2147483649").is_err());
        assert_eq!(
            serde_json::from_str::<U64>("18446744073709551615").unwrap(),
            U64(u64::MAX)
        );
        assert!(serde_json::from_str::<U64>("18446744073709551616").is_err());
    }

    #[test]
    fn safe_integer_ceiling_and_decimal_strings_keep_their_original_contracts() {
        assert_eq!(serde_json::from_str::<SafeU64>("-0").unwrap(), SafeU64(0));
        assert_eq!(
            serde_json::from_str::<SafeU64>("9007199254740991").unwrap(),
            SafeU64(SAFE_INTEGER)
        );
        assert!(serde_json::from_str::<SafeU64>("9007199254740992").is_err());
        assert!(decode::<SafeU64>(b"9007199254740992", 64).is_err());
        for token in ["-0.0", "-0e0", "1.0", "1e0", "-1", "true", "\"0\""] {
            assert!(serde_json::from_str::<SafeU64>(token).is_err(), "{token}");
        }
        assert!(serde_json::from_str::<Decimal>("-0").is_err());
        assert!(serde_json::from_str::<Decimal>("\"-0\"").is_err());
        assert_eq!(
            serde_json::from_str::<Decimal>("\"0\"").unwrap(),
            Decimal(0)
        );
    }

    #[test]
    fn list_elements_and_required_nullable_values_use_lexical_integers() {
        assert_eq!(
            serde_json::from_str::<Collection>(r#"{"values":[-0,1,4294967295],"nullable":-0}"#)
                .unwrap(),
            Collection {
                values: vec![0, 1, u32::MAX],
                nullable: Some(0)
            }
        );
        assert_eq!(
            serde_json::from_str::<Collection>(r#"{"values":[],"nullable":null}"#).unwrap(),
            Collection {
                values: vec![],
                nullable: None
            }
        );
        for text in [
            r#"{"values":[]}"#,
            r#"{"nullable":null}"#,
            r#"{"values":[-0.0],"nullable":null}"#,
            r#"{"values":[-0e0],"nullable":null}"#,
            r#"{"values":[1.0],"nullable":null}"#,
            r#"{"values":[1e0],"nullable":null}"#,
            r#"{"values":[-1],"nullable":null}"#,
            r#"{"values":[4294967296],"nullable":null}"#,
            r#"{"values":[],"nullable":-0.0}"#,
            r#"{"values":[],"nullable":-0e0}"#,
            r#"{"values":[],"nullable":1e0}"#,
            r#"{"values":[],"nullable":4294967296}"#,
            r#"{"values":[],"nullable":true}"#,
        ] {
            assert!(serde_json::from_str::<Collection>(text).is_err(), "{text}");
        }
    }
}

// SPEC: _spec/packages/training/artifact-lifecycle.puml
use std::collections::BTreeMap;
use std::fmt;
use std::marker::PhantomData;

use serde::de::{self, DeserializeOwned, DeserializeSeed, MapAccess, SeqAccess, Visitor, value::MapAccessDeserializer};
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use sha2::{Digest, Sha256};

pub const ARTIFACT_BYTE_CAP: usize = 1_048_576;
pub const CHECKPOINT_BYTE_CAP: usize = 16_777_216;
pub const MAX_SAFE_INTEGER: u64 = 9_007_199_254_740_991;
pub const MAX_JSON_NODES: usize = 131_072;
pub const MAX_JSON_ARRAY_LEN: usize = 8192;
pub const MAX_JSON_OBJECT_LEN: usize = 128;
pub const MAX_JSON_DEPTH: usize = 64;
pub const MAX_JSON_STRING_BYTES: usize = 1024;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ArtifactError {
    Limit,
    Canonical,
    Schema,
    Float,
    Manifest,
    Binding,
    Counters,
    Rng,
    MissingEvidence,
}

impl fmt::Display for ArtifactError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::Limit => "artifact byte limit",
            Self::Canonical => "noncanonical artifact bytes",
            Self::Schema => "artifact schema",
            Self::Float => "nonfinite or malformed float64",
            Self::Manifest => "feature registry mismatch",
            Self::Binding => "artifact reference mismatch",
            Self::Counters => "training counter mismatch",
            Self::Rng => "checkpoint RNG mismatch",
            Self::MissingEvidence => "independent evidence required",
        })
    }
}

impl std::error::Error for ArtifactError {}

pub type ArtifactResult<T> = Result<T, ArtifactError>;

pub(crate) fn object_only<'de, D, T>(deserializer: D) -> Result<T, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    struct ObjectVisitor<T>(PhantomData<T>);
    impl<'de, T: Deserialize<'de>> Visitor<'de> for ObjectVisitor<T> {
        type Value = T;
        fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
            formatter.write_str("an object")
        }
        fn visit_map<M: MapAccess<'de>>(self, map: M) -> Result<T, M::Error> {
            T::deserialize(MapAccessDeserializer::new(map))
        }
    }
    deserializer.deserialize_map(ObjectVisitor(PhantomData))
}

macro_rules! object_wire {
    ($vis:vis struct $name:ident { $($(#[$meta:meta])* $field:ident: $ty:ty),* $(,)? }) => {
        #[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
        #[serde(rename_all = "camelCase")]
        $vis struct $name { $($(#[$meta])* pub(crate) $field: $ty),* }
        impl<'de> serde::Deserialize<'de> for $name {
            fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
                #[derive(serde::Deserialize)]
                #[serde(rename_all = "camelCase", deny_unknown_fields)]
                struct Wire { $($(#[$meta])* $field: $ty),* }
                let Wire { $($field),* } = $crate::artifact_bytes::object_only(deserializer)?;
                Ok(Self { $($field),* })
            }
        }
    };
}
pub(crate) use object_wire;

pub(crate) fn required_nullable<'de, D, T>(deserializer: D) -> Result<Option<T>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::deserialize(deserializer)
}

pub(crate) fn fixed_418<'de, D, T>(deserializer: D) -> Result<Vec<T>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    struct FixedVisitor<T>(PhantomData<T>);
    impl<'de, T: Deserialize<'de>> Visitor<'de> for FixedVisitor<T> {
        type Value = Vec<T>;
        fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
            formatter.write_str("418 entries")
        }
        fn visit_seq<A: SeqAccess<'de>>(self, mut sequence: A) -> Result<Self::Value, A::Error> {
            let mut values = Vec::with_capacity(418);
            for _ in 0..418 {
                values.push(sequence.next_element()?.ok_or_else(|| de::Error::custom("418 entries required"))?);
            }
            if sequence.next_element::<de::IgnoredAny>()?.is_some() {
                return Err(de::Error::custom("418 entries required"));
            }
            Ok(values)
        }
    }
    deserializer.deserialize_seq(FixedVisitor(PhantomData))
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ByteRef {
    byte_length: u64,
    sha256: String,
}

impl ByteRef {
    pub fn new(byte_length: u64, sha256: &str) -> ArtifactResult<Self> {
        if byte_length > MAX_SAFE_INTEGER || !lower_hex(sha256, 64) {
            return Err(ArtifactError::Schema);
        }
        Ok(Self { byte_length, sha256: sha256.to_owned() })
    }

    pub fn of_bytes(bytes: &[u8]) -> Self {
        let digest = Sha256::digest(bytes);
        let mut sha256 = String::with_capacity(64);
        const HEX: &[u8; 16] = b"0123456789abcdef";
        for byte in digest {
            sha256.push(char::from(HEX[(byte >> 4) as usize]));
            sha256.push(char::from(HEX[(byte & 15) as usize]));
        }
        Self { byte_length: bytes.len() as u64, sha256 }
    }

    pub fn byte_length(&self) -> u64 { self.byte_length }
    pub fn sha256(&self) -> &str { &self.sha256 }

    pub fn matches(&self, bytes: &[u8]) -> bool {
        self.byte_length == bytes.len() as u64 && *self == Self::of_bytes(bytes)
    }
}

impl<'de> Deserialize<'de> for ByteRef {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase", deny_unknown_fields)]
        struct Wire { byte_length: u64, sha256: String }
        let raw: Wire = object_only(deserializer)?;
        Self::new(raw.byte_length, &raw.sha256).map_err(de::Error::custom)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Float64Hex(u64);

impl Float64Hex {
    pub fn from_hex(hex: &str) -> ArtifactResult<Self> {
        if !lower_hex(hex, 16) { return Err(ArtifactError::Float); }
        let bits = u64::from_str_radix(hex, 16).map_err(|_| ArtifactError::Float)?;
        if (bits >> 52) & 0x7ff == 0x7ff { return Err(ArtifactError::Float); }
        Ok(Self(bits))
    }

    pub fn from_f64(value: f64) -> ArtifactResult<Self> {
        if !value.is_finite() { return Err(ArtifactError::Float); }
        Ok(Self(value.to_bits()))
    }

    pub fn to_f64(self) -> f64 { f64::from_bits(self.0) }
    pub fn bits(self) -> u64 { self.0 }
}

impl Serialize for Float64Hex {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        #[derive(Serialize)]
        struct Wire { hex: String }
        Wire { hex: format!("{:016x}", self.0) }.serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for Float64Hex {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct Wire { hex: String }
        let raw: Wire = object_only(deserializer)?;
        Self::from_hex(&raw.hex).map_err(de::Error::custom)
    }
}

fn lower_hex(text: &str, width: usize) -> bool {
    text.len() == width && text.bytes().all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

struct CanonicalValue(serde_json::Value);

#[derive(Default)]
struct JsonBudget {
    nodes: usize,
    exhausted: bool,
}

impl JsonBudget {
    fn limit<E: de::Error>(&mut self) -> E {
        self.exhausted = true;
        E::custom("JSON structure limit")
    }

    fn enter<E: de::Error>(&mut self, depth: usize, full: bool) -> Result<(), E> {
        if full || depth > MAX_JSON_DEPTH || self.nodes >= MAX_JSON_NODES {
            return Err(self.limit());
        }
        self.nodes += 1;
        Ok(())
    }

    fn string<E: de::Error>(&mut self, value: &str) -> Result<(), E> {
        if value.len() > MAX_JSON_STRING_BYTES { return Err(self.limit()); }
        Ok(())
    }
}

struct CanonicalKeySeed<'a> {
    budget: &'a mut JsonBudget,
    depth: usize,
    full: bool,
}

impl<'de> DeserializeSeed<'de> for CanonicalKeySeed<'_> {
    type Value = String;

    fn deserialize<D: Deserializer<'de>>(self, deserializer: D) -> Result<Self::Value, D::Error> {
        self.budget.enter::<D::Error>(self.depth, self.full)?;
        struct KeyVisitor<'a>(&'a mut JsonBudget);
        impl<'de> Visitor<'de> for KeyVisitor<'_> {
            type Value = String;
            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("a bounded object key")
            }
            fn visit_str<E: de::Error>(self, value: &str) -> Result<String, E> {
                self.0.string::<E>(value)?;
                Ok(value.to_owned())
            }
            fn visit_string<E: de::Error>(self, value: String) -> Result<String, E> {
                self.0.string::<E>(&value)?;
                Ok(value)
            }
        }
        deserializer.deserialize_str(KeyVisitor(self.budget))
    }
}

struct CanonicalValueSeed<'a> {
    budget: &'a mut JsonBudget,
    depth: usize,
    full: bool,
}

impl<'de> DeserializeSeed<'de> for CanonicalValueSeed<'_> {
    type Value = CanonicalValue;

    fn deserialize<D: Deserializer<'de>>(self, deserializer: D) -> Result<Self::Value, D::Error> {
        self.budget.enter::<D::Error>(self.depth, self.full)?;
        struct CanonicalVisitor<'a> {
            budget: &'a mut JsonBudget,
            depth: usize,
        }
        impl<'de> Visitor<'de> for CanonicalVisitor<'_> {
            type Value = CanonicalValue;
            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("canonical integer-only JSON")
            }
            fn visit_bool<E: de::Error>(self, value: bool) -> Result<Self::Value, E> {
                Ok(CanonicalValue(value.into()))
            }
            fn visit_unit<E: de::Error>(self) -> Result<Self::Value, E> {
                Ok(CanonicalValue(serde_json::Value::Null))
            }
            fn visit_str<E: de::Error>(self, value: &str) -> Result<Self::Value, E> {
                self.budget.string::<E>(value)?;
                Ok(CanonicalValue(value.to_owned().into()))
            }
            fn visit_string<E: de::Error>(self, value: String) -> Result<Self::Value, E> {
                self.budget.string::<E>(&value)?;
                Ok(CanonicalValue(value.into()))
            }
            fn visit_u64<E: de::Error>(self, value: u64) -> Result<Self::Value, E> {
                if value > MAX_SAFE_INTEGER { return Err(E::custom("integer domain")); }
                Ok(CanonicalValue(value.into()))
            }
            fn visit_i64<E: de::Error>(self, value: i64) -> Result<Self::Value, E> {
                if value.unsigned_abs() > MAX_SAFE_INTEGER { return Err(E::custom("integer domain")); }
                Ok(CanonicalValue(value.into()))
            }
            fn visit_f64<E: de::Error>(self, _: f64) -> Result<Self::Value, E> {
                Err(E::custom("JSON floats are forbidden"))
            }
            fn visit_seq<A: SeqAccess<'de>>(self, mut sequence: A) -> Result<Self::Value, A::Error> {
                let mut values = Vec::new();
                while let Some(CanonicalValue(value)) = sequence.next_element_seed(CanonicalValueSeed {
                    budget: &mut *self.budget, depth: self.depth + 1, full: values.len() >= MAX_JSON_ARRAY_LEN,
                })? {
                    values.push(value);
                }
                Ok(CanonicalValue(values.into()))
            }
            fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Self::Value, A::Error> {
                let mut values = BTreeMap::new();
                while let Some(key) = map.next_key_seed(CanonicalKeySeed {
                    budget: &mut *self.budget, depth: self.depth + 1, full: values.len() >= MAX_JSON_OBJECT_LEN,
                })? {
                    if values.contains_key(&key) { return Err(de::Error::custom("duplicate key")); }
                    let CanonicalValue(value) = map.next_value_seed(CanonicalValueSeed {
                        budget: &mut *self.budget, depth: self.depth + 1, full: false,
                    })?;
                    values.insert(key, value);
                }
                Ok(CanonicalValue(serde_json::Value::Object(values.into_iter().collect())))
            }
        }
        deserializer.deserialize_any(CanonicalVisitor { budget: self.budget, depth: self.depth })
    }
}

fn emit_canonical(value: &serde_json::Value, bytes: &mut Vec<u8>) -> ArtifactResult<()> {
    match value {
        serde_json::Value::Object(object) => {
            bytes.push(b'{');
            let sorted: BTreeMap<_, _> = object.iter().collect();
            for (index, (key, value)) in sorted.into_iter().enumerate() {
                if index != 0 { bytes.push(b','); }
                serde_json::to_writer(&mut *bytes, key).map_err(|_| ArtifactError::Canonical)?;
                bytes.push(b':');
                emit_canonical(value, bytes)?;
            }
            bytes.push(b'}');
        }
        serde_json::Value::Array(array) => {
            bytes.push(b'[');
            for (index, value) in array.iter().enumerate() {
                if index != 0 { bytes.push(b','); }
                emit_canonical(value, bytes)?;
            }
            bytes.push(b']');
        }
        _ => serde_json::to_writer(bytes, value).map_err(|_| ArtifactError::Canonical)?,
    }
    Ok(())
}

pub(crate) fn decode_canonical<T: DeserializeOwned>(bytes: &[u8], cap: usize) -> ArtifactResult<T> {
    if bytes.len() > cap { return Err(ArtifactError::Limit); }
    let mut decoder = serde_json::Deserializer::from_slice(bytes);
    let mut budget = JsonBudget::default();
    let parsed = CanonicalValueSeed { budget: &mut budget, depth: 0, full: false }.deserialize(&mut decoder);
    let CanonicalValue(value) = parsed.map_err(|_| {
        if budget.exhausted { ArtifactError::Limit } else { ArtifactError::Canonical }
    })?;
    decoder.end().map_err(|_| ArtifactError::Canonical)?;
    let mut canonical = Vec::with_capacity(bytes.len());
    emit_canonical(&value, &mut canonical)?;
    if canonical != bytes { return Err(ArtifactError::Canonical); }
    serde_json::from_slice(bytes).map_err(|_| ArtifactError::Schema)
}

pub struct DiagnosticParsed<T> {
    value: T,
    reference: ByteRef,
}

impl<T> DiagnosticParsed<T> {
    pub fn byte_ref(&self) -> &ByteRef { &self.reference }
    pub(crate) fn value(&self) -> &T { &self.value }
    pub(crate) fn into_value(self) -> T { self.value }
    pub(crate) fn capture(value: T, original: &[u8]) -> Self {
        Self { value, reference: ByteRef::of_bytes(original) }
    }
}

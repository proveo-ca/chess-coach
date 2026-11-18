// SPEC: _spec/host-entrypoint.puml
use serde::de::{
    self, DeserializeOwned, DeserializeSeed, IgnoredAny, MapAccess, SeqAccess, Visitor,
};
use serde::{Deserialize, Deserializer, Serialize};
use std::fmt;

#[derive(Deserialize, Serialize)]
#[serde(rename_all(serialize = "camelCase"))]
pub(crate) struct VersionFacts {
    #[serde(rename(deserialize = "Version"))]
    pub(crate) version: String,
    #[serde(rename(deserialize = "ApiVersion"))]
    pub(crate) api_version: String,
    #[serde(rename(deserialize = "MinAPIVersion"))]
    pub(crate) min_api_version: String,
    #[serde(rename(deserialize = "Os"))]
    pub(crate) os: String,
    #[serde(rename(deserialize = "Arch"))]
    pub(crate) arch: String,
    #[serde(rename(deserialize = "KernelVersion"))]
    pub(crate) kernel_version: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all(serialize = "camelCase"))]
pub(crate) struct InfoFacts {
    #[serde(rename(deserialize = "OSType"))]
    pub(crate) os_type: String,
    #[serde(rename(deserialize = "Architecture"))]
    pub(crate) architecture: String,
    #[serde(rename(deserialize = "KernelVersion"))]
    pub(crate) kernel_version: String,
    #[serde(rename(deserialize = "NCPU"))]
    pub(crate) cpu_count: u64,
    #[serde(rename(deserialize = "MemTotal"))]
    pub(crate) memory_bytes: u64,
    #[serde(rename(deserialize = "CgroupDriver"))]
    pub(crate) cgroup_driver: String,
    #[serde(rename(deserialize = "CgroupVersion"))]
    pub(crate) cgroup_version: String,
    #[serde(rename(deserialize = "DefaultRuntime"))]
    pub(crate) default_runtime: String,
    #[serde(
        rename(deserialize = "SecurityOptions"),
        deserialize_with = "deserialize_security_options"
    )]
    pub(crate) security_options: Vec<String>,
    #[serde(
        rename(deserialize = "Runtimes"),
        deserialize_with = "deserialize_runtime_names"
    )]
    pub(crate) runtime_names: Vec<String>,
}

pub(crate) fn parse_version(bytes: &[u8]) -> Result<VersionFacts, &'static str> {
    let facts: VersionFacts = parse_json(bytes)?;
    let strings = [
        &facts.version,
        &facts.api_version,
        &facts.min_api_version,
        &facts.os,
        &facts.arch,
        &facts.kernel_version,
    ];
    if strings.iter().all(|value| valid_string(value, 128)) {
        Ok(facts)
    } else {
        Err("PROJECTION")
    }
}

pub(crate) fn parse_info(bytes: &[u8]) -> Result<InfoFacts, &'static str> {
    let facts: InfoFacts = parse_json(bytes)?;
    let strings = [
        &facts.os_type,
        &facts.architecture,
        &facts.kernel_version,
        &facts.cgroup_driver,
        &facts.cgroup_version,
        &facts.default_runtime,
    ];
    if strings.iter().all(|value| valid_string(value, 256))
        && (1..=8192).contains(&facts.cpu_count)
        && (1..=i64::MAX as u64).contains(&facts.memory_bytes)
    {
        Ok(facts)
    } else {
        Err("PROJECTION")
    }
}

fn parse_json<T: DeserializeOwned>(bytes: &[u8]) -> Result<T, &'static str> {
    check_json_nesting(bytes)?;
    serde_json::from_slice(bytes).map_err(|error| {
        if error.is_data() {
            "PROJECTION"
        } else {
            "JSON"
        }
    })
}

fn check_json_nesting(bytes: &[u8]) -> Result<(), &'static str> {
    std::str::from_utf8(bytes).map_err(|_| "JSON")?;
    let first = bytes
        .iter()
        .copied()
        .find(|byte| !matches!(byte, b' ' | b'\t' | b'\r' | b'\n'));
    if first != Some(b'{') {
        return Err("JSON");
    }

    let mut depth = 0_usize;
    let mut quoted = false;
    let mut escaped = false;
    for &byte in bytes {
        if quoted {
            if escaped {
                escaped = false;
            } else if byte == b'\\' {
                escaped = true;
            } else if byte == b'"' {
                quoted = false;
            }
        } else {
            match byte {
                b'"' => quoted = true,
                b'{' | b'[' => {
                    depth += 1;
                    if depth >= 128 {
                        return Err("JSON");
                    }
                }
                b'}' | b']' => depth = depth.checked_sub(1).ok_or("JSON")?,
                _ => {}
            }
        }
    }
    if quoted || depth != 0 {
        Err("JSON")
    } else {
        Ok(())
    }
}

fn valid_string(value: &str, max_bytes: usize) -> bool {
    !value.is_empty()
        && value.len() <= max_bytes
        && !value.bytes().any(|byte| byte.is_ascii_control())
}

struct SecurityOptionSeed {
    at_capacity: bool,
}

impl<'de> DeserializeSeed<'de> for SecurityOptionSeed {
    type Value = String;

    fn deserialize<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
    where
        D: Deserializer<'de>,
    {
        if self.at_capacity {
            return Err(de::Error::custom("PROJECTION"));
        }
        let value = String::deserialize(deserializer)?;
        if valid_string(&value, 256) {
            Ok(value)
        } else {
            Err(de::Error::custom("PROJECTION"))
        }
    }
}

fn deserialize_security_options<'de, D>(deserializer: D) -> Result<Vec<String>, D::Error>
where
    D: Deserializer<'de>,
{
    struct SecurityOptionsVisitor;

    impl<'de> Visitor<'de> for SecurityOptionsVisitor {
        type Value = Vec<String>;

        fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
            formatter.write_str("SecurityOptions array")
        }

        fn visit_seq<A>(self, mut sequence: A) -> Result<Self::Value, A::Error>
        where
            A: SeqAccess<'de>,
        {
            let mut options = Vec::new();
            while let Some(option) = sequence.next_element_seed(SecurityOptionSeed {
                at_capacity: options.len() == 32,
            })? {
                options.push(option);
            }
            Ok(options)
        }
    }

    deserializer.deserialize_seq(SecurityOptionsVisitor)
}

struct RuntimeNameSeed {
    at_capacity: bool,
}

impl<'de> DeserializeSeed<'de> for RuntimeNameSeed {
    type Value = String;

    fn deserialize<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
    where
        D: Deserializer<'de>,
    {
        if self.at_capacity {
            return Err(de::Error::custom("PROJECTION"));
        }
        let name = String::deserialize(deserializer)?;
        let mut bytes = name.bytes();
        if name.len() <= 128
            && bytes
                .next()
                .is_some_and(|byte| byte.is_ascii_alphanumeric())
            && bytes.all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'.' | b'-'))
        {
            Ok(name)
        } else {
            Err(de::Error::custom("PROJECTION"))
        }
    }
}

fn deserialize_runtime_names<'de, D>(deserializer: D) -> Result<Vec<String>, D::Error>
where
    D: Deserializer<'de>,
{
    struct RuntimeNamesVisitor;

    impl<'de> Visitor<'de> for RuntimeNamesVisitor {
        type Value = Vec<String>;

        fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
            formatter.write_str("Runtimes object")
        }

        fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
        where
            A: MapAccess<'de>,
        {
            let mut names = Vec::new();
            while let Some(name) = map.next_key_seed(RuntimeNameSeed {
                at_capacity: names.len() == 32,
            })? {
                if names.contains(&name) {
                    return Err(de::Error::custom("PROJECTION"));
                }
                map.next_value::<IgnoredAny>()?;
                names.push(name);
            }
            names.sort_unstable();
            Ok(names)
        }
    }

    deserializer.deserialize_map(RuntimeNamesVisitor)
}

#[cfg(test)]
mod tests {
    use super::*;

    const VERSION_FIELDS: [(&str, &str); 6] = [
        ("Version", r#""27.4.0""#),
        ("ApiVersion", r#""1.47""#),
        ("MinAPIVersion", r#""1.24""#),
        ("Os", r#""linux""#),
        ("Arch", r#""amd64""#),
        ("KernelVersion", r#""6.12.0""#),
    ];
    const INFO_FIELDS: [(&str, &str); 10] = [
        ("OSType", r#""linux""#),
        ("Architecture", r#""x86_64""#),
        ("KernelVersion", r#""6.12.0""#),
        ("NCPU", "8"),
        ("MemTotal", "17179869184"),
        ("CgroupDriver", r#""systemd""#),
        ("CgroupVersion", r#""2""#),
        ("DefaultRuntime", r#""runc""#),
        ("SecurityOptions", r#"["name=seccomp","name=cgroupns"]"#),
        ("Runtimes", r#"{"runc":{},"nvidia":{}}"#),
    ];
    const INFO_STRING_FIELDS: [&str; 6] = [
        "OSType",
        "Architecture",
        "KernelVersion",
        "CgroupDriver",
        "CgroupVersion",
        "DefaultRuntime",
    ];
    const VERSION_REPORT: &str = r#"{"version":"27.4.0","apiVersion":"1.47","minApiVersion":"1.24","os":"linux","arch":"amd64","kernelVersion":"6.12.0"}"#;
    const INFO_REPORT: &str = r#"{"osType":"linux","architecture":"x86_64","kernelVersion":"6.12.0","cpuCount":8,"memoryBytes":17179869184,"cgroupDriver":"systemd","cgroupVersion":"2","defaultRuntime":"runc","securityOptions":["name=seccomp","name=cgroupns"],"runtimeNames":["nvidia","runc"]}"#;

    fn fixture(fields: &[(&str, &str)], replacement: Option<(&str, &str)>) -> String {
        let fields = fields
            .iter()
            .map(|&(name, original)| {
                let value = match replacement {
                    Some((field, value)) if field == name => value,
                    _ => original,
                };
                format!(r#""{name}":{value}"#)
            })
            .collect::<Vec<_>>()
            .join(",");
        format!("{{{fields}}}")
    }

    fn version() -> String {
        fixture(&VERSION_FIELDS, None)
    }

    fn info() -> String {
        fixture(&INFO_FIELDS, None)
    }

    fn version_with(field: &str, value: &str) -> String {
        fixture(&VERSION_FIELDS, Some((field, value)))
    }

    fn info_with(field: &str, value: &str) -> String {
        fixture(&INFO_FIELDS, Some((field, value)))
    }

    fn append_field(json: &str, field: &str, value: &str) -> String {
        format!(r#"{},"{field}":{value}}}"#, json.strip_suffix('}').unwrap())
    }

    fn array(value: &str, count: usize) -> String {
        format!("[{}]", vec![value; count].join(","))
    }

    fn runtime_map(count: usize) -> String {
        let entries = (0..count)
            .map(|index| format!(r#""runtime{index}":{{}}"#))
            .collect::<Vec<_>>()
            .join(",");
        format!("{{{entries}}}")
    }

    #[test]
    fn valid_version_serializes_only_selected_camel_case_fields() {
        let facts = parse_version(version().as_bytes()).unwrap();
        assert_eq!(serde_json::to_string(&facts).unwrap(), VERSION_REPORT);
    }

    #[test]
    fn valid_info_serializes_only_selected_fields_and_sorted_runtime_names() {
        let facts = parse_info(info().as_bytes()).unwrap();
        assert_eq!(serde_json::to_string(&facts).unwrap(), INFO_REPORT);
    }

    #[test]
    fn version_requires_every_selected_field() {
        for (omitted, _) in VERSION_FIELDS {
            let remaining = VERSION_FIELDS
                .iter()
                .copied()
                .filter(|(field, _)| *field != omitted)
                .collect::<Vec<_>>();
            assert_eq!(
                parse_version(fixture(&remaining, None).as_bytes()).err(),
                Some("PROJECTION"),
                "{omitted}"
            );
        }
    }

    #[test]
    fn info_requires_every_selected_field() {
        for (omitted, _) in INFO_FIELDS {
            let remaining = INFO_FIELDS
                .iter()
                .copied()
                .filter(|(field, _)| *field != omitted)
                .collect::<Vec<_>>();
            assert_eq!(
                parse_info(fixture(&remaining, None).as_bytes()).err(),
                Some("PROJECTION"),
                "{omitted}"
            );
        }
    }

    #[test]
    fn version_rejects_non_string_selected_fields() {
        for (field, _) in VERSION_FIELDS {
            for value in ["null", "true", "false", "0", "1.5", "[]", "{}"] {
                assert_eq!(
                    parse_version(version_with(field, value).as_bytes()).err(),
                    Some("PROJECTION"),
                    "{field}: {value}"
                );
            }
        }
    }

    #[test]
    fn info_rejects_non_string_selected_strings() {
        for field in INFO_STRING_FIELDS {
            for value in ["null", "true", "false", "0", "1.5", "[]", "{}"] {
                assert_eq!(
                    parse_info(info_with(field, value).as_bytes()).err(),
                    Some("PROJECTION"),
                    "{field}: {value}"
                );
            }
        }
    }

    #[test]
    fn version_rejects_empty_oversized_and_ascii_control_strings() {
        let mut invalid = vec![String::new(), "a".repeat(129)];
        invalid.extend(
            (0_u8..=31)
                .chain([127])
                .map(|byte| format!("a{}b", char::from(byte))),
        );
        for (field, _) in VERSION_FIELDS {
            for value in &invalid {
                let encoded = serde_json::to_string(value).unwrap();
                assert_eq!(
                    parse_version(version_with(field, &encoded).as_bytes()).err(),
                    Some("PROJECTION"),
                    "{field}: {value:?}"
                );
            }
        }
    }

    #[test]
    fn info_rejects_empty_oversized_and_ascii_control_strings() {
        let mut invalid = vec![String::new(), "a".repeat(257)];
        invalid.extend(
            (0_u8..=31)
                .chain([127])
                .map(|byte| format!("a{}b", char::from(byte))),
        );
        for field in INFO_STRING_FIELDS {
            for value in &invalid {
                let encoded = serde_json::to_string(value).unwrap();
                assert_eq!(
                    parse_info(info_with(field, &encoded).as_bytes()).err(),
                    Some("PROJECTION"),
                    "{field}: {value:?}"
                );
            }
        }
    }

    #[test]
    fn version_string_bounds_count_utf8_bytes() {
        for (field, _) in VERSION_FIELDS {
            for value in ["a".repeat(128), "é".repeat(64)] {
                let encoded = serde_json::to_string(&value).unwrap();
                assert!(parse_version(version_with(field, &encoded).as_bytes()).is_ok());
            }
            let encoded = serde_json::to_string(&"é".repeat(65)).unwrap();
            assert_eq!(
                parse_version(version_with(field, &encoded).as_bytes()).err(),
                Some("PROJECTION")
            );
        }
    }

    #[test]
    fn info_string_bounds_count_utf8_bytes() {
        for field in INFO_STRING_FIELDS {
            for value in ["a".repeat(256), "é".repeat(128), "界".repeat(85)] {
                let encoded = serde_json::to_string(&value).unwrap();
                assert!(parse_info(info_with(field, &encoded).as_bytes()).is_ok());
            }
            for value in ["é".repeat(129), "界".repeat(86)] {
                let encoded = serde_json::to_string(&value).unwrap();
                assert_eq!(
                    parse_info(info_with(field, &encoded).as_bytes()).err(),
                    Some("PROJECTION")
                );
            }
        }
    }

    #[test]
    fn cpu_count_enforces_inclusive_bounds() {
        for value in ["1", "8192"] {
            assert!(parse_info(info_with("NCPU", value).as_bytes()).is_ok());
        }
        for value in ["0", "-1", "8193", "18446744073709551615"] {
            assert_eq!(
                parse_info(info_with("NCPU", value).as_bytes()).err(),
                Some("PROJECTION")
            );
        }
    }

    #[test]
    fn memory_bytes_enforces_inclusive_bounds() {
        for value in ["1", "9223372036854775807"] {
            assert!(parse_info(info_with("MemTotal", value).as_bytes()).is_ok());
        }
        for value in ["0", "-1", "9223372036854775808", "18446744073709551615"] {
            assert_eq!(
                parse_info(info_with("MemTotal", value).as_bytes()).err(),
                Some("PROJECTION")
            );
        }
    }

    #[test]
    fn numeric_fields_reject_floats_booleans_strings_null_and_collections() {
        for field in ["NCPU", "MemTotal"] {
            for value in [
                "1.0", "1e0", "-1.0", "1.5", "-0", "true", "false", r#""1""#, "null", "[]", "{}",
            ] {
                assert_eq!(
                    parse_info(info_with(field, value).as_bytes()).err(),
                    Some("PROJECTION"),
                    "{field}: {value}"
                );
            }
        }
    }

    #[test]
    fn security_options_accept_zero_and_32_entries() {
        for count in [0, 32] {
            let options = array(r#""name=seccomp""#, count);
            let facts = parse_info(info_with("SecurityOptions", &options).as_bytes()).unwrap();
            assert_eq!(facts.security_options.len(), count);
        }
    }

    #[test]
    fn security_options_reject_33_entries() {
        let options = array(r#""name=seccomp""#, 33);
        assert_eq!(
            parse_info(info_with("SecurityOptions", &options).as_bytes()).err(),
            Some("PROJECTION")
        );
    }

    #[test]
    fn security_options_stop_before_deserializing_entry_33() {
        let options = format!(r#"[{},"\q"]"#, vec![r#""ok""#; 32].join(","));
        let mut deserializer = serde_json::Deserializer::from_str(&options);
        let error = deserialize_security_options(&mut deserializer)
            .err()
            .unwrap();
        assert!(error.is_data());
    }

    #[test]
    fn security_options_require_an_array_of_valid_strings() {
        for value in ["null", "true", "1", "{}", r#""option""#] {
            assert_eq!(
                parse_info(info_with("SecurityOptions", value).as_bytes()).err(),
                Some("PROJECTION")
            );
        }
        let mut invalid = vec![String::new(), "a".repeat(257), "é".repeat(129)];
        invalid.extend(
            (0_u8..=31)
                .chain([127])
                .map(|byte| format!("a{}b", char::from(byte))),
        );
        for value in invalid {
            let options = serde_json::to_string(&[value]).unwrap();
            assert_eq!(
                parse_info(info_with("SecurityOptions", &options).as_bytes()).err(),
                Some("PROJECTION")
            );
        }
        for value in ["null", "true", "1", "1.5", "[]", "{}"] {
            assert_eq!(
                parse_info(info_with("SecurityOptions", &array(value, 1)).as_bytes()).err(),
                Some("PROJECTION")
            );
        }
        for value in ["a".repeat(256), "é".repeat(128)] {
            let options = serde_json::to_string(&[value]).unwrap();
            assert!(parse_info(info_with("SecurityOptions", &options).as_bytes()).is_ok());
        }
    }

    #[test]
    fn runtime_names_accept_zero_and_32_entries() {
        for count in [0, 32] {
            let facts = parse_info(info_with("Runtimes", &runtime_map(count)).as_bytes()).unwrap();
            assert_eq!(facts.runtime_names.len(), count);
            assert!(facts.runtime_names.windows(2).all(|pair| pair[0] < pair[1]));
        }
    }

    #[test]
    fn runtime_names_reject_33_entries() {
        assert_eq!(
            parse_info(info_with("Runtimes", &runtime_map(33)).as_bytes()).err(),
            Some("PROJECTION")
        );
    }

    #[test]
    fn runtime_names_stop_before_deserializing_key_33() {
        let runtimes = append_field(&runtime_map(32), r#"\q"#, "null");
        let mut deserializer = serde_json::Deserializer::from_str(&runtimes);
        let error = deserialize_runtime_names(&mut deserializer).err().unwrap();
        assert!(error.is_data());
    }

    #[test]
    fn runtime_names_reject_duplicates_including_escaped_duplicates() {
        for runtimes in [
            r#"{"runc":{},"runc":null}"#,
            r#"{"runc":{},"\u0072unc":{"path":"SECRET_CANARY"}}"#,
        ] {
            assert_eq!(
                parse_info(info_with("Runtimes", runtimes).as_bytes()).err(),
                Some("PROJECTION")
            );
        }
    }

    #[test]
    fn runtime_names_enforce_ascii_grammar_and_byte_bound() {
        for name in [
            "runc".to_owned(),
            "9Runtime_foo.bar-baz".to_owned(),
            "a".repeat(128),
        ] {
            let key = serde_json::to_string(&name).unwrap();
            let runtimes = format!("{{{key}:null}}");
            assert!(parse_info(info_with("Runtimes", &runtimes).as_bytes()).is_ok());
        }
        for name in [
            "".to_owned(),
            "_runc".to_owned(),
            ".runc".to_owned(),
            "-runc".to_owned(),
            "a b".to_owned(),
            "a/b".to_owned(),
            "a\\b".to_owned(),
            "a:b".to_owned(),
            "a\n".to_owned(),
            "a\u{7f}".to_owned(),
            "é".to_owned(),
            "aé".to_owned(),
            "a".repeat(129),
        ] {
            let key = serde_json::to_string(&name).unwrap();
            let runtimes = format!("{{{key}:null}}");
            assert_eq!(
                parse_info(info_with("Runtimes", &runtimes).as_bytes()).err(),
                Some("PROJECTION"),
                "{name:?}"
            );
        }
    }

    #[test]
    fn runtimes_require_an_object_but_ignore_every_value_type() {
        for value in ["null", "true", "1", "[]", r#""runc""#] {
            assert_eq!(
                parse_info(info_with("Runtimes", value).as_bytes()).err(),
                Some("PROJECTION")
            );
        }
        for value in [
            "null",
            "true",
            "1",
            "1.5",
            "1e400",
            r#""SECRET_CANARY""#,
            "[]",
            r#"{"path":"SECRET_CANARY","args":[{"secret":true}]}"#,
        ] {
            let runtimes = format!(r#"{{"runc":{value}}}"#);
            let facts = parse_info(info_with("Runtimes", &runtimes).as_bytes()).unwrap();
            assert_eq!(facts.runtime_names, ["runc"]);
            assert!(
                !serde_json::to_string(&facts)
                    .unwrap()
                    .contains("SECRET_CANARY")
            );
        }
    }

    #[test]
    fn duplicate_selected_fields_are_rejected() {
        for (field, value) in VERSION_FIELDS {
            let json = append_field(&version(), field, value);
            assert_eq!(parse_version(json.as_bytes()).err(), Some("PROJECTION"));
        }
        for (field, value) in INFO_FIELDS {
            let json = append_field(&info(), field, value);
            assert_eq!(parse_info(json.as_bytes()).err(), Some("PROJECTION"));
        }
        let json = append_field(&version(), r#"\u0056ersion"#, r#""duplicate""#);
        assert_eq!(parse_version(json.as_bytes()).err(), Some("PROJECTION"));
    }

    #[test]
    fn malformed_json_and_nested_ignored_values_are_rejected() {
        for json in ["", "{", "{]", "null", "[]", r#"{"Version":}"#] {
            assert_eq!(parse_version(json.as_bytes()).err(), Some("JSON"));
            assert_eq!(parse_info(json.as_bytes()).err(), Some("JSON"));
        }
        for value in [
            r#"{"nested":[1,]}"#,
            r#"{"nested":}"#,
            r#"{"nested":"\q"}"#,
            r#"{"nested":[true false]}"#,
            r#"{"nested":tru}"#,
        ] {
            let version_json = append_field(&version(), "Unknown", value);
            let info_json = append_field(&info(), "Unknown", value);
            assert_eq!(parse_version(version_json.as_bytes()).err(), Some("JSON"));
            assert_eq!(parse_info(info_json.as_bytes()).err(), Some("JSON"));
            let runtimes = format!(r#"{{"runc":{value}}}"#);
            assert_eq!(
                parse_info(info_with("Runtimes", &runtimes).as_bytes()).err(),
                Some("JSON")
            );
        }
    }

    #[test]
    fn ignored_values_preserve_the_default_json_nesting_limit() {
        for count in [126, 127, 256] {
            let nested = format!("{}0{}", "[".repeat(count), "]".repeat(count));
            let version_json = append_field(&version(), "Unknown", &nested);
            let info_json = append_field(&info(), "Unknown", &nested);
            if count == 126 {
                assert!(parse_version(version_json.as_bytes()).is_ok());
                assert!(parse_info(info_json.as_bytes()).is_ok());
            } else {
                assert_eq!(parse_version(version_json.as_bytes()).err(), Some("JSON"));
                assert_eq!(parse_info(info_json.as_bytes()).err(), Some("JSON"));
            }
        }
        for count in [125, 126, 256] {
            let nested = format!("{}0{}", "[".repeat(count), "]".repeat(count));
            let runtimes = format!(r#"{{"runc":{nested}}}"#);
            let json = info_with("Runtimes", &runtimes);
            if count == 125 {
                assert!(parse_info(json.as_bytes()).is_ok());
            } else {
                assert_eq!(parse_info(json.as_bytes()).err(), Some("JSON"));
            }
        }
    }

    #[test]
    fn nesting_checks_ignore_escaped_quotes_and_delimiters_inside_strings() {
        let text = serde_json::to_string(&r#"\\\"[{}]"#.repeat(256)).unwrap();
        let version_json = append_field(&version(), "Unknown", &text);
        let info_json = append_field(&info(), "Unknown", &text);
        assert!(parse_version(version_json.as_bytes()).is_ok());
        assert!(parse_info(info_json.as_bytes()).is_ok());
        let runtimes = format!(r#"{{"runc":{text}}}"#);
        assert!(parse_info(info_with("Runtimes", &runtimes).as_bytes()).is_ok());
    }

    #[test]
    fn trailing_json_is_rejected_but_json_whitespace_is_accepted() {
        for suffix in ["{}", "null", " garbage", ",", "\u{a0}"] {
            let version_json = format!("{}{suffix}", version());
            let info_json = format!("{}{suffix}", info());
            assert_eq!(parse_version(version_json.as_bytes()).err(), Some("JSON"));
            assert_eq!(parse_info(info_json.as_bytes()).err(), Some("JSON"));
        }
        assert!(parse_version(format!(" \t\r\n{} \t\r\n", version()).as_bytes()).is_ok());
        assert!(parse_info(format!(" \t\r\n{} \t\r\n", info()).as_bytes()).is_ok());
    }

    #[test]
    fn invalid_utf8_is_rejected_in_selected_and_ignored_strings() {
        fn corrupt(json: String) -> Vec<u8> {
            let mut bytes = json.into_bytes();
            let offset = bytes
                .windows(b"UTF8_MARKER".len())
                .position(|window| window == b"UTF8_MARKER")
                .unwrap();
            bytes[offset] = 0xff;
            bytes
        }

        let selected_version = corrupt(version_with("Version", r#""UTF8_MARKER""#));
        let ignored_version = corrupt(append_field(&version(), "Unknown", r#""UTF8_MARKER""#));
        let selected_info = corrupt(info_with("OSType", r#""UTF8_MARKER""#));
        let ignored_info = corrupt(append_field(&info(), "Unknown", r#""UTF8_MARKER""#));
        let runtime_info = corrupt(info_with("Runtimes", r#"{"runc":{"path":"UTF8_MARKER"}}"#));
        for bytes in [selected_version, ignored_version] {
            assert_eq!(parse_version(&bytes).err(), Some("JSON"));
        }
        for bytes in [selected_info, ignored_info, runtime_info] {
            assert_eq!(parse_info(&bytes).err(), Some("JSON"));
        }
    }

    #[test]
    fn unknown_fields_and_runtime_values_never_serialize_secret_canaries() {
        let unknown = r#"{"Name":"SECRET_CANARY_HOST","Labels":["SECRET_CANARY_LABEL"],"Config":{"Auth":"SECRET_CANARY_AUTH"},"HugeNumber":1e400}"#;
        let version_json = append_field(&version(), "Unknown", unknown);
        let version_facts = parse_version(version_json.as_bytes()).unwrap();
        let version_report = serde_json::to_string(&version_facts).unwrap();
        assert_eq!(version_report, VERSION_REPORT);
        assert!(!version_report.contains("SECRET_CANARY"));

        let runtimes = r#"{"runc":{"path":"/SECRET_CANARY_PATH","runtimeArgs":["SECRET_CANARY_ARG"],"options":{"config":"SECRET_CANARY_CONFIG"}},"nvidia":{"path":"SECRET_CANARY_NVIDIA"}}"#;
        let info_json = append_field(&info_with("Runtimes", runtimes), "Unknown", unknown);
        let info_facts = parse_info(info_json.as_bytes()).unwrap();
        let info_report = serde_json::to_string(&info_facts).unwrap();
        assert_eq!(info_report, INFO_REPORT);
        assert!(!info_report.contains("SECRET_CANARY"));
    }
}

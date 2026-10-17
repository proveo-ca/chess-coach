// SPEC: _spec/apps/arena/burn-compat.puml
use crate::ArenaResult;
use serde::{Deserialize, Deserializer, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub(crate) struct Square(u8);

impl Square {
    pub(crate) fn file(self) -> u8 {
        self.0 / 8 + 1
    }
    pub(crate) fn rank(self) -> u8 {
        self.0 % 8 + 1
    }
    pub(crate) fn index(self) -> usize {
        usize::from(self.0)
    }
}

impl TryFrom<String> for Square {
    type Error = String;
    fn try_from(value: String) -> Result<Self, Self::Error> {
        let bytes = value.as_bytes();
        if bytes.len() != 2
            || !(b'a'..=b'h').contains(&bytes[0])
            || !(b'1'..=b'8').contains(&bytes[1])
        {
            return Err("Square must match [a-h][1-8]".into());
        }
        Ok(Self((bytes[0] - b'a') * 8 + bytes[1] - b'1'))
    }
}

impl From<Square> for String {
    fn from(value: Square) -> Self {
        format!("{}{}", char::from(b'a' + value.0 / 8), value.rank())
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) enum Color {
    #[serde(rename = "w")]
    White,
    #[serde(rename = "b")]
    Black,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) enum Piece {
    #[serde(rename = "p")]
    Pawn,
    #[serde(rename = "n")]
    Knight,
    #[serde(rename = "b")]
    Bishop,
    #[serde(rename = "r")]
    Rook,
    #[serde(rename = "q")]
    Queen,
    #[serde(rename = "k")]
    King,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct ObservedPiece {
    pub(crate) color: Color,
    #[serde(rename = "type")]
    pub(crate) kind: Piece,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "visibility", rename_all = "lowercase", deny_unknown_fields)]
pub(crate) enum Cell {
    Unknown {
        square: Square,
    },
    Lit {
        square: Square,
        #[serde(deserialize_with = "required_nullable")]
        piece: Option<ObservedPiece>,
    },
    Revealed {
        square: Square,
        piece: ObservedPiece,
    },
}

impl Cell {
    pub(crate) fn square(&self) -> Square {
        match self {
            Self::Unknown { square } | Self::Lit { square, .. } | Self::Revealed { square, .. } => {
                *square
            }
        }
    }
}

pub(crate) fn required_nullable<'de, D, T>(deserializer: D) -> Result<Option<T>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::deserialize(deserializer)
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct OwnPiece {
    pub(crate) square: Square,
    #[serde(rename = "type")]
    pub(crate) kind: Piece,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Own {
    pub(crate) minerals: u32,
    pub(crate) gas: u32,
    pub(crate) gas_income: u32,
    pub(crate) cc_lives: u32,
    pub(crate) pieces: Vec<OwnPiece>,
    pub(crate) mines: Vec<Square>,
    pub(crate) sieged_tanks: Vec<Square>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) enum ObservationVersion {
    #[serde(rename = "arena-smoke-observation-v1")]
    V1,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Observation {
    pub(crate) version: ObservationVersion,
    pub(crate) side: Color,
    pub(crate) turn: u32,
    pub(crate) own: Own,
    pub(crate) cells: Vec<Cell>,
}

impl Observation {
    pub(crate) fn validate(&self) -> ArenaResult<()> {
        if self.turn > 45 || self.own.minerals > 12 || self.own.cc_lives > 3 {
            return Err("Observation resource or turn bound exceeded".into());
        }
        if self.cells.len() != 64
            || self
                .cells
                .iter()
                .enumerate()
                .any(|(index, cell)| cell.square().index() != index)
        {
            return Err("Observation requires 64 canonical file/rank ordered cells".into());
        }
        if self
            .own
            .pieces
            .windows(2)
            .any(|pair| pair[0].square >= pair[1].square)
        {
            return Err("Own piece inventory must be uniquely sorted".into());
        }
        let mut visible_own = Vec::new();
        for cell in &self.cells {
            match cell {
                Cell::Lit {
                    square,
                    piece: Some(piece),
                } if piece.color == self.side => {
                    visible_own.push(OwnPiece {
                        square: *square,
                        kind: piece.kind,
                    });
                }
                Cell::Revealed { piece, .. } if piece.color == self.side => {
                    return Err("Own pieces must occupy lit cells".into());
                }
                _ => {}
            }
        }
        if visible_own != self.own.pieces {
            return Err("Own inventory disagrees with visible own pieces".into());
        }
        if self.own.mines.len() > 2 || self.own.mines.windows(2).any(|pair| pair[0] > pair[1]) {
            return Err("Own mine multiset must be sorted with at most two entries".into());
        }
        if self
            .own
            .sieged_tanks
            .windows(2)
            .any(|pair| pair[0] >= pair[1])
            || self.own.sieged_tanks.iter().any(|square| {
                !self
                    .own
                    .pieces
                    .iter()
                    .any(|piece| piece.square == *square && piece.kind == Piece::Rook)
            })
        {
            return Err("Sieged tanks must identify uniquely sorted own rooks".into());
        }
        Ok(())
    }
}

#[cfg(test)]
pub(crate) fn fixture() -> Observation {
    let king = Square::try_from("e1".to_owned()).unwrap();
    Observation {
        version: ObservationVersion::V1,
        side: Color::White,
        turn: 0,
        own: Own {
            minerals: 3,
            gas: 1,
            gas_income: 1,
            cc_lives: 3,
            pieces: vec![OwnPiece {
                square: king,
                kind: Piece::King,
            }],
            mines: vec![],
            sieged_tanks: vec![],
        },
        cells: (0..64)
            .map(|index| {
                let square = Square(index);
                if square == king {
                    Cell::Lit {
                        square,
                        piece: Some(ObservedPiece {
                            color: Color::White,
                            kind: Piece::King,
                        }),
                    }
                } else if (4..=6).contains(&square.file()) && square.rank() <= 2 {
                    Cell::Lit {
                        square,
                        piece: None,
                    }
                } else {
                    Cell::Unknown { square }
                }
            })
            .collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn squares_use_closed_ascii_grammar() {
        for valid in ["a1", "h8", "e1"] {
            let square: Square = serde_json::from_value(json!(valid)).unwrap();
            assert_eq!(String::from(square), valid);
        }
        for invalid in ["a0", "a9", "i1", "A1", "a11", "é1", "", "a1 "] {
            assert!(serde_json::from_value::<Square>(json!(invalid)).is_err());
        }
    }

    #[test]
    fn closed_cell_variants_reject_hidden_and_missing_fields() {
        for value in [
            json!({"square":"a1","visibility":"unknown","piece":null}),
            json!({"square":"a1","visibility":"lit"}),
            json!({"square":"a1","visibility":"revealed","piece":null}),
            json!({"square":"a1","visibility":"lit","piece":{"color":"w","type":"k","gas":1}}),
        ] {
            assert!(serde_json::from_value::<Cell>(value).is_err());
        }
        assert!(
            serde_json::from_value::<Cell>(json!({"square":"a1","visibility":"lit","piece":null}))
                .is_ok()
        );
    }

    #[test]
    fn observation_accepts_sorted_duplicate_mines_without_deduplicating() {
        let mut observed = fixture();
        let square = Square::try_from("c3".to_owned()).unwrap();
        observed.own.mines = vec![square, square];
        observed.validate().unwrap();
        let decoded: Observation =
            serde_json::from_slice(&serde_json::to_vec(&observed).unwrap()).unwrap();
        assert_eq!(decoded, observed);
        assert_eq!(decoded.own.mines.len(), 2);
        observed.own.mines.push(square);
        assert!(observed.validate().is_err());
    }

    #[test]
    fn observation_checks_inventory_order_resources_and_siege() {
        fixture().validate().unwrap();
        let mut cases = Vec::new();
        let mut value = fixture();
        value.cells.swap(0, 1);
        cases.push(value);
        let mut value = fixture();
        value.cells.pop();
        cases.push(value);
        let mut value = fixture();
        value.own.pieces.clear();
        cases.push(value);
        let mut value = fixture();
        value.own.pieces.push(value.own.pieces[0].clone());
        cases.push(value);
        let mut value = fixture();
        value.own.minerals = 13;
        cases.push(value);
        let mut value = fixture();
        value.own.cc_lives = 4;
        cases.push(value);
        let mut value = fixture();
        value.turn = 46;
        cases.push(value);
        let mut value = fixture();
        value.own.sieged_tanks.push(value.own.pieces[0].square);
        cases.push(value);
        for value in cases {
            assert!(value.validate().is_err());
        }
        let mut value = serde_json::to_value(fixture()).unwrap();
        value["own"]["gas"] = json!(-1);
        assert!(serde_json::from_value::<Observation>(value).is_err());
    }

    #[test]
    fn observation_rejects_extra_private_state_at_every_boundary() {
        for path in ["root", "own", "piece"] {
            let mut value = serde_json::to_value(fixture()).unwrap();
            match path {
                "root" => value["snapshot"] = json!({}),
                "own" => value["own"]["opponentGas"] = json!(1),
                _ => value["own"]["pieces"][0]["color"] = json!("w"),
            }
            assert!(serde_json::from_value::<Observation>(value).is_err());
        }
    }
}

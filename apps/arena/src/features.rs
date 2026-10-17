// SPEC: _spec/apps/arena/burn-compat.puml
use crate::ArenaResult;
use crate::observation::{Cell, Color, Observation, Piece, Square};
use crate::protocol::Action;
use serde::Serialize;

#[derive(Debug, PartialEq, Serialize)]
pub(crate) struct FeatureMatrix {
    pub(crate) rows: usize,
    pub(crate) columns: usize,
    pub(crate) values: Vec<f64>,
}

#[derive(Debug, Serialize)]
pub(crate) struct ScoredCandidate {
    pub(crate) key: String,
    pub(crate) action: Action,
    pub(crate) score: f64,
}

#[derive(Debug, Serialize)]
pub(crate) struct Selection {
    pub(crate) index: usize,
    pub(crate) key: String,
    pub(crate) action: Action,
    pub(crate) score: f64,
}

pub(crate) fn synthetic_candidates(observation: &Observation) -> ArenaResult<Vec<Action>> {
    observation.validate()?;
    let kings: Vec<_> = observation
        .own
        .pieces
        .iter()
        .filter(|piece| piece.kind == Piece::King)
        .collect();
    if kings.len() != 1 {
        return Err("Synthetic candidates require one observed own king".into());
    }
    let from = kings[0].square;
    if observation.side != Color::White || observation.turn != 0 || String::from(from) != "e1" {
        return Err("Synthetic candidates require the white e1 king at frame zero".into());
    }
    ["d1", "f1"]
        .into_iter()
        .map(|name| {
            let to = Square::try_from(name.to_owned())?;
            if !matches!(
                observation.cells.get(to.index()),
                Some(Cell::Lit { piece: None, .. })
            ) {
                return Err("Synthetic king destinations must be lit and empty".into());
            }
            Ok(Action::classical(from, to))
        })
        .collect()
}

pub(crate) fn synthetic_features(actions: &[Action]) -> FeatureMatrix {
    let mut values = vec![0.0; actions.len() * training_native::COLUMNS];
    for (index, action) in actions.iter().enumerate() {
        values[index * training_native::COLUMNS] = f64::from(action.to.file());
        values[index * training_native::COLUMNS + 1] = f64::from(action.to.rank());
    }
    FeatureMatrix {
        rows: actions.len(),
        columns: training_native::COLUMNS,
        values,
    }
}

pub(crate) fn select_highest_score(actions: &[Action], scores: &[f64]) -> ArenaResult<Selection> {
    if actions.is_empty() || actions.len() != scores.len() {
        return Err("Burn score count must equal the nonempty candidate count".into());
    }
    let mut selected: Option<Selection> = None;
    for (index, (action, &score)) in actions.iter().zip(scores).enumerate() {
        if !score.is_finite() {
            return Err("Burn scores must be finite".into());
        }
        let key = action.canonical_key();
        if selected.as_ref().is_none_or(|previous| {
            score > previous.score || (score == previous.score && key < previous.key)
        }) {
            selected = Some(Selection {
                index,
                key,
                action: action.clone(),
                score,
            });
        }
    }
    selected.ok_or_else(|| "No scored candidate".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::observation::fixture;

    #[test]
    fn candidates_and_rows_use_only_observed_own_king_and_lit_empty_cells() {
        let observation = fixture();
        let actions = synthetic_candidates(&observation).unwrap();
        assert_eq!(String::from(actions[0].to), "d1");
        assert_eq!(String::from(actions[1].to), "f1");
        let matrix = synthetic_features(&actions);
        assert_eq!(
            (matrix.rows, matrix.columns, matrix.values.len()),
            (2, 418, 836)
        );
        assert_eq!(&matrix.values[..2], &[4.0, 1.0]);
        assert_eq!(&matrix.values[418..420], &[6.0, 1.0]);
        assert!(
            matrix.values[2..418]
                .iter()
                .chain(&matrix.values[420..])
                .all(|&v| v == 0.0)
        );
        let twin: Observation =
            serde_json::from_slice(&serde_json::to_vec(&observation).unwrap()).unwrap();
        assert_eq!(
            synthetic_features(&synthetic_candidates(&twin).unwrap()),
            matrix
        );
    }

    #[test]
    fn candidate_generation_rejects_unknown_occupied_and_missing_king() {
        let mut observation = fixture();
        let square = Square::try_from("d1".to_owned()).unwrap();
        observation.cells[square.index()] = Cell::Unknown { square };
        assert!(synthetic_candidates(&observation).is_err());
        let mut observation = fixture();
        observation.cells[square.index()] = Cell::Lit {
            square,
            piece: Some(crate::observation::ObservedPiece {
                color: Color::Black,
                kind: Piece::Knight,
            }),
        };
        assert!(synthetic_candidates(&observation).is_err());
        let mut observation = fixture();
        observation.own.pieces[0].kind = Piece::Rook;
        let king = observation.own.pieces[0].square;
        observation.cells[king.index()] = Cell::Lit {
            square: king,
            piece: Some(crate::observation::ObservedPiece {
                color: Color::White,
                kind: Piece::Rook,
            }),
        };
        assert!(synthetic_candidates(&observation).is_err());
    }

    #[test]
    fn selection_preserves_original_index_and_uses_canonical_ties() {
        let mut actions = synthetic_candidates(&fixture()).unwrap();
        assert_eq!(
            select_highest_score(&actions, &[1.875, 2.875])
                .unwrap()
                .index,
            1
        );
        assert_eq!(
            select_highest_score(&actions, &[7.0, 2.0]).unwrap().index,
            0
        );
        actions.reverse();
        let selection = select_highest_score(&actions, &[5.0, 5.0]).unwrap();
        assert_eq!(selection.index, 1);
        assert_eq!(String::from(selection.action.to), "d1");
        assert_eq!(
            selection.key,
            r#"{"color":"w","from":"e1","kind":"classical","timing":"C","to":"d1"}"#
        );
    }

    #[test]
    fn selection_rejects_empty_mismatched_and_nonfinite_scores() {
        let actions = synthetic_candidates(&fixture()).unwrap();
        assert!(select_highest_score(&[], &[]).is_err());
        for scores in [
            vec![1.0],
            vec![1.0, 2.0, 3.0],
            vec![0.0, f64::NAN],
            vec![0.0, f64::INFINITY],
            vec![0.0, f64::NEG_INFINITY],
        ] {
            assert!(select_highest_score(&actions, &scores).is_err());
        }
    }
}

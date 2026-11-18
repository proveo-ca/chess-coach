// SPEC: _spec/_plans/chess-ui-primitives.puml
import type { Component, JSX } from "solid-js";
import clsx from "clsx";

import { Modal } from "./Modal";
import type { ModalPosition } from "../types/ui";
import styles from "./NeonModal.module.css";

export type NeonModalSize = "md" | "lg";

export type NeonModalProps = {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children: JSX.Element;
  dismissible?: boolean;
  showCloseButton?: boolean;
  position?: ModalPosition;
  /** Panel width: md (New Game / Leave Match), lg (Credits). */
  size?: NeonModalSize;
  contentClass?: string;
};

export const NeonModal: Component<NeonModalProps> = (props) => {
  const size = () => props.size ?? "md";
  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={props.title}
      dismissible={props.dismissible}
      showCloseButton={props.showCloseButton}
      position={props.position ?? "fixed"}
      overlayClass={styles.overlay}
      contentClass={clsx(
        styles.panel,
        size() === "lg" ? styles["panel--lg"] : styles["panel--md"],
        props.contentClass,
      )}
    >
      {props.children}
    </Modal>
  );
};

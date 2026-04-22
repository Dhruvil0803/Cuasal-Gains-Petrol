// src/components/DropdownFormUI/UI/Modal.jsx
import React from "react";
import Button from "./Button";

/**
 * Accessible modal with backdrop.
 * Classes from ../ui.css: .modal-backdrop, .modal, .modal-header, .modal-body, .modal-actions
 */
export default function Modal({
  open,
  title,
  children,
  onClose,
  primaryAction,   // { label, onClick, loading }
  secondaryAction, // { label, onClick }
}) {
  if (!open) return null;

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={handleBackdrop}>
      <div className="modal" role="document">
        <div className="modal-header">{title}</div>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">
          {secondaryAction ? (
            <Button variant="ghost" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          ) : (
            <Button variant="ghost" onClick={onClose}>Close</Button>
          )}
          {primaryAction ? (
            <Button variant="primary" onClick={primaryAction.onClick} loading={primaryAction.loading}>
              {primaryAction.label}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

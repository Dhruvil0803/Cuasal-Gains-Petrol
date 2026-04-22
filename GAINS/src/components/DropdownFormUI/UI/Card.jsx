// src/components/DropdownFormUI/UI/Card.jsx
import React from "react";

/**
 * Card layout wrapper: header / body / footer slots.
 * Uses .card, .card-header, .card-title, .card-body, .card-footer from ../ui.css
 */
export default function Card({ title, subtitle, tabs, footer, children, headerActions, className = "" }) {
  return (
    <div className={`card ${className}`.trim()}>
      <div className="card-header">
        <h3 className="card-title">
          {title || ""}
          {subtitle ? <span className="card-subtitle"> {subtitle}</span> : null}
        </h3>
        {tabs ? <div className="tabs-inline">{tabs}</div> : null}
        {headerActions ? <div className="header-actions">{headerActions}</div> : null}
      </div>
      <div className="card-body">{children}</div>
      {footer ? <div className="card-footer">{footer}</div> : null}
    </div>
  );
}

// src/components/DropdownFormUI/ErrorBoundary.jsx
import React from "react";

/**
 * Small error boundary (mirrors original behavior)
 * - On error: renders a <pre class="alert"> with the error text
 * - Otherwise: renders children
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }

  static getDerivedStateFromError(err) {
    return { err };
  }

  componentDidCatch(error, info) {
    // Optional: log to monitoring here
    // console.error("[ErrorBoundary]", error, info);
  }

  render() {
    const { err } = this.state;
    if (err) {
      return (
        <pre className="alert" style={{ margin: 16 }}>
          {String(err)}
        </pre>
      );
    }
    return this.props.children;
  }
}

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import GateKeeper from "./components/GateKeeper";
import prism from "prismjs";
window.Prism = prism;

// Simple error boundary so React crashes show on screen
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <pre style={{
          padding: "20px",
          color: "red",
          whiteSpace: "pre-wrap"
        }}>
          {String(this.state.error)}
        </pre>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <GateKeeper>
      <App />
    </GateKeeper>
  </ErrorBoundary>
);

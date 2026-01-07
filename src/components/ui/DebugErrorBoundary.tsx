import React, { ErrorInfo, ReactNode } from 'react';
import { System } from '../../lib/api';

interface Props {
  children?: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class DebugErrorBoundary extends React.Component<Props, State> {
  // Fix: Explicitly declare props for environments where React.Component properties are not being inherited correctly in types
  public props!: Props;

  state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Fix: Access props which were explicitly declared above
    const name = this.props.componentName || 'Unknown Component';
    // ⚡ Log to VS Code Terminal
    System.error(`CRASH in ${name}`, error);
    // Fix: Use @ts-ignore if setState is not found on class by type checker
    // @ts-ignore
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-destructive/10 border border-destructive rounded-xl text-destructive space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
             {/* Fix: Access props which were explicitly declared above */}
             💥 Component Crashed: {this.props.componentName}
          </h2>
          <p className="font-mono text-sm bg-black/5 p-4 rounded overflow-auto whitespace-pre-wrap">
            {this.state.error?.toString()}
          </p>
          <details className="text-xs opacity-80 cursor-pointer">
            <summary>Stack Trace</summary>
            <pre className="mt-2 p-2 bg-black/5 rounded overflow-auto">
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-destructive text-white rounded hover:opacity-90 transition"
          >
            Reload App
          </button>
        </div>
      );
    }

    // Fix: Access props which were explicitly declared above
    return this.props.children;
  }
}
import { Component, type ReactNode } from 'react';
import { HOME } from '../route';

export default class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="state" role="alert">
          <p>Something went wrong showing this page.</p>
          <a href={HOME}>Back to all identities</a>
        </div>
      );
    }
    return this.props.children;
  }
}

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  handleRetry = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="error-boundary">
          <div className="error-boundary-card">
            <span className="error-boundary-icon">⚠️</span>
            <h2>发生了意外错误</h2>
            <p className="error-boundary-message">{this.state.error.message}</p>
            <button className="btn btn-primary" onClick={this.handleRetry}>
              重试
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

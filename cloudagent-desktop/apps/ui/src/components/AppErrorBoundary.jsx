import React from 'react';
import { isStaleAssetError, reloadForFreshAssets } from '@/lib/staleAssetRecovery';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    if (isStaleAssetError(error)) reloadForFreshAssets(window);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">CloudAgent UI needs to reload</h1>
          <p className="mt-2 text-sm text-slate-600">
            The local UI files changed while this window was open. Reload to continue with the current version.
          </p>
          <button
            type="button"
            className="mt-5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            onClick={() => window.location.reload()}
          >
            Reload CloudAgent
          </button>
        </div>
      </div>
    );
  }
}


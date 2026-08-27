import { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    // Catch render and lifecycle crashes in the client shell so one broken
    // route or widget does not blank the whole app.
    if (import.meta.env.VITE_ENABLE_API_DEBUG === "true") {
      console.error("[ORBIT ErrorBoundary]", error, errorInfo);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <main className="min-h-screen bg-[#050506] px-4 py-10 text-zinc-100">
          <section className="orbit-shell mx-auto max-w-3xl">
            <div className="rounded-lg border border-amber-300/20 bg-white/[0.035] p-6 shadow-2xl shadow-black/30">
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-amber-300/30 bg-amber-300/10 text-amber-200">
                  <AlertTriangle size={20} />
                </span>
                <div className="min-w-0">
                  <p className="orbit-kicker">Application Error</p>
                  <h1 className="mt-2 text-2xl font-black text-white">
                    BLACK FLASH ORBIT paused on a render error.
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                    Runtime error terjadi di client. Reload untuk memulai ulang
                    sesi UI tanpa mengubah data backend.
                  </p>
                </div>
              </div>

              <button
                aria-label="Reload application"
                className="orbit-primary-button mt-6 inline-flex"
                onClick={this.handleReload}
                type="button">
                <RefreshCw size={17} />
                Reload
              </button>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Bot,
  Command,
  FileText,
  Globe2,
  LayoutDashboard,
  Search,
  Sparkles,
} from "lucide-react";
import { ORBIT_RELEASE_METADATA } from "../config/releaseMetadata.js";

export function CommandPalette({ commands = [], isOpen, onClose, onSelect }) {
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [lastExecution, setLastExecution] = useState(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const rafId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      window.cancelAnimationFrame(rafId);
    };
  }, [isOpen]);

  const filteredCommands = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const isSlashQuery = needle.startsWith("/");

    if (!needle) return commands;

    return commands.filter((command) => {
      if (isSlashQuery && command.kind !== "slash") return false;

      const haystack = [
        command.label,
        command.description,
        ...(command.keywords || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [commands, query]);

  const selectedCommand = filteredCommands[activeIndex] || filteredCommands[0] || null;

  useEffect(() => {
    if (!isOpen) return;
    setActiveIndex((current) =>
      filteredCommands.length === 0
        ? 0
        : Math.min(current, filteredCommands.length - 1),
    );
  }, [filteredCommands.length, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (!filteredCommands.length) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % filteredCommands.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex(
          (current) =>
            (current - 1 + filteredCommands.length) % filteredCommands.length,
        );
      } else if (event.key === "Enter") {
        event.preventDefault();
        const command = filteredCommands[activeIndex];
        if (command) onSelect(command);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, filteredCommands, isOpen, onClose, onSelect]);

  function handleSelect(command) {
    setLastExecution({
      commandId: command.id,
      label: command.label,
      result:
        command.mockResult ||
        `Mock execution ready for ${command.label}. No live action was performed.`,
      timestamp: new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Asia/Jayapura",
      }),
    });
    onSelect(command);
  }

  if (!isOpen) return null;

  return (
    <div className="orbit-palette-layer" role="presentation">
      <button
        aria-label="Close command palette"
        className="orbit-palette-overlay"
        onClick={onClose}
        type="button"
      />

      <section
        aria-label="Command Palette"
        aria-modal="true"
        className="orbit-palette"
        role="dialog">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
            <Command size={18} />
          </div>

          <div className="min-w-0">
            <p className="orbit-kicker">
              {ORBIT_RELEASE_METADATA.module} {ORBIT_RELEASE_METADATA.releaseVersion}
            </p>
            <h2 className="truncate text-sm font-black text-white">
              Search or run slash commands
            </h2>
          </div>
        </div>

        <div className="border-b border-white/10 px-4 py-3">
          <label className="orbit-palette-search">
            <Search size={16} />
            <input
              aria-label="Search commands"
              autoComplete="off"
              className="orbit-palette-input"
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  onClose();
                  return;
                }

                if (!filteredCommands.length) return;

                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((current) => (current + 1) % filteredCommands.length);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex(
                    (current) =>
                      (current - 1 + filteredCommands.length) % filteredCommands.length,
                  );
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  const command = filteredCommands[activeIndex];
                  if (command) handleSelect(command);
                }
              }}
              placeholder="Type /build, /scan, /security..."
              ref={inputRef}
              value={query}
            />
          </label>
        </div>

        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.84fr)]">
          <div className="max-h-[min(52vh,26rem)] overflow-y-auto p-2 lg:max-h-[min(62vh,32rem)]">
            {filteredCommands.length ? (
              <div className="grid gap-1">
                {filteredCommands.map((command, index) => {
                  const Icon = command.icon || LayoutDashboard;
                  const isActive = index === activeIndex;

                  return (
                    <button
                      className={`orbit-palette-item ${
                        isActive ? "is-active" : ""
                      }`}
                      key={command.id || command.label}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => handleSelect(command)}
                      type="button">
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-cyan-200">
                        <Icon size={16} />
                      </span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="flex items-center gap-2 truncate text-sm font-black text-white">
                          {command.label}
                          {command.kind === "slash" ? (
                            <span className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-cyan-200">
                              Slash
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 block truncate text-xs text-zinc-500">
                          {command.description}
                        </span>
                      </span>
                      {command.hotkey ? (
                        <span className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                          {command.hotkey}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="orbit-empty-state mx-2 my-2 grid gap-2 px-4 py-6 text-center">
                <Sparkles className="mx-auto text-cyan-300" size={22} />
                <p className="text-sm font-bold text-white">No commands found</p>
                <p className="text-xs leading-6 text-zinc-500">
                  Try another keyword or clear the search input.
                </p>
              </div>
            )}
          </div>

          <aside className="border-t border-white/10 p-3 lg:border-l lg:border-t-0">
            {selectedCommand ? (
              <div className="grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="orbit-kicker">Selected Command</p>
                      <h3 className="mt-2 text-base font-black text-white">
                        {selectedCommand.label}
                      </h3>
                    </div>
                    <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                      {selectedCommand.kind === "slash" ? "Mock" : "Navigate"}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-zinc-400">
                    {selectedCommand.description}
                  </p>

                  <div className="mt-4 grid gap-2 text-xs">
                    <DetailRow label="Command" value={selectedCommand.label} />
                    <DetailRow
                      label="Mode"
                      value={selectedCommand.kind === "slash" ? "Safe mock execution" : "Route navigation"}
                    />
                    <DetailRow
                      label="Keywords"
                      value={(selectedCommand.keywords || []).join(", ") || "-"}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">
                    Mock Execution Result
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {lastExecution?.commandId === selectedCommand.id
                      ? lastExecution.result
                      : selectedCommand.mockResult ||
                        `Preview only. Select ${selectedCommand.label} to execute a safe mock action.`}
                  </p>
                  <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    {lastExecution?.commandId === selectedCommand.id
                      ? `Updated ${lastExecution.timestamp}`
                      : "No live action has been run yet"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="orbit-empty-state grid gap-2 px-4 py-8 text-center">
                <Sparkles className="mx-auto text-cyan-300" size={22} />
                <p className="text-sm font-bold text-white">No command selected</p>
                <p className="text-xs leading-6 text-zinc-500">
                  Type a slash command or move through suggestions to inspect details.
                </p>
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </span>
      <span className="max-w-[60%] text-right text-[11px] font-semibold text-zinc-200">
        {value}
      </span>
    </div>
  );
}

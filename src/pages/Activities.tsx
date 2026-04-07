import { useMemo, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useFilters } from "../context/FilterContext";
import { useActivities } from "../hooks/useSupabase";
import type { Activity } from "../types";

type StatusFilter = "Concluído" | "Em dia" | "Em atraso" | null;

type ActivityRow = {
  key: string;
  level: 1 | 2 | 3 | 4 | 5;
  type: "n0" | "n1" | "n2" | "n3" | "n4";
  label: string;
  n0: string;
  n1: string;
  n2: string;
  n3: string;
  status: string;
  con: number;
  dia: number;
  atr: number;
  exe: number;
  exeObj: number;
  deadline: string | null;
  activity?: Activity;
};

export default function Activities() {
  const { n0, n1 } = useFilters();
  const { data: activities, loading, error } = useActivities({ n0, n1 });

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());

  const statusCounts = useMemo(() => {
    if (!activities) return { total: 0, completed: 0, onTime: 0, late: 0 };
    return {
      total: activities.length,
      completed: activities.filter((a) => a.status === "Concluído").length,
      onTime: activities.filter((a) => a.status === "Em dia").length,
      late: activities.filter((a) => a.status === "Em atraso").length,
    };
  }, [activities]);

  const filteredActivities = useMemo(() => {
    if (!activities) return [];
    const query = searchQuery.trim().toLowerCase();
    return activities.filter((activity) => {
      if (statusFilter && activity.status !== statusFilter) return false;
      if (!query) return true;
      return [activity.nome, activity.n1, activity.n0, activity.status].some(
        (value) => (value || "").toLowerCase().includes(query),
      );
    });
  }, [activities, searchQuery, statusFilter]);

  const rows = useMemo(() => {
    if (!filteredActivities.length) return [] as ActivityRow[];

    const hasMultiN0 =
      new Set(filteredActivities.map((a) => a.n0 || "")).size > 1;
    const cutoffDate = new Date();

    const kpi = (rows: Activity[]) => {
      const total = rows.length;
      const con = rows.filter((d) => d.status === "Concluído").length;
      const dia = rows.filter((d) => d.status === "Em dia").length;
      const atr = rows.filter((d) => d.status === "Em atraso").length;
      const exe = total
        ? rows.reduce((sum, d) => sum + (d.pct || 0), 0) / total
        : 0;
      const exeObj = total
        ? rows.reduce((sum, d) => sum + (d.pct_prev || 0), 0) / total
        : 0;
      return { con, dia, atr, exe, exeObj };
    };

    const datesFromN4 = (rows: Activity[]) => {
      const starts = rows.map((d) => d.rs || d.bs).filter(Boolean) as string[];
      const ends = rows.map((d) => d.rf || d.bf).filter(Boolean) as string[];
      const start = starts.length
        ? starts.reduce((a, b) => (a < b ? a : b))
        : null;
      const end = ends.length ? ends.reduce((a, b) => (a > b ? a : b)) : null;
      return { start, end };
    };

    const statusFromDates = (percent: number, end?: string | null) => {
      if (percent >= 100) return "Concluído";
      if (!end) return "Em dia";
      const d = new Date(end);
      d.setHours(0, 0, 0, 0);
      return d > cutoffDate ? "Em dia" : "Em atraso";
    };

    const statusFromLeaves = (rows: Activity[]) => {
      const total = rows.length;
      if (!total) return "";
      const con = rows.filter((d) => d.status === "Concluído").length;
      const atr = rows.filter((d) => d.status === "Em atraso").length;
      if (con === total) return "Concluído";
      if (atr > 0) return "Em atraso";
      return "Em dia";
    };

    const localeSort = (values: string[]) =>
      [...values].sort((a, b) =>
        a.localeCompare(b, "pt", { numeric: true, sensitivity: "base" }),
      );

    const rowsOut: ActivityRow[] = [];

    const n0Values = localeSort(
      Array.from(new Set(filteredActivities.map((d) => d.n0 || ""))).filter(
        Boolean,
      ),
    );
    const renderN1Block = (n1Value: string, subset: Activity[]) => {
      const n1Key = `n1_${encodeURIComponent(n1Value)}`;
      const kn1 = kpi(subset);
      const dt1 = datesFromN4(subset);
      rowsOut.push({
        key: n1Key,
        level: 2,
        type: "n1",
        label: n1Value,
        n0: subset[0].n0 || "",
        n1: n1Value,
        n2: "",
        n3: "",
        status: statusFromDates(kn1.exe, dt1.end),
        con: kn1.con,
        dia: kn1.dia,
        atr: kn1.atr,
        exe: kn1.exe,
        exeObj: kn1.exeObj,
        deadline: dt1.end,
      });

      const n2Values = localeSort(
        Array.from(new Set(subset.map((d) => d.n2 || ""))).filter(Boolean),
      );
      n2Values.forEach((n2Value) => {
        const subset2 = subset.filter((d) => d.n2 === n2Value);
        const n2Key = `n2_${encodeURIComponent(n1Value)}_${encodeURIComponent(n2Value)}`;
        const kn2 = kpi(subset2);
        const dt2 = datesFromN4(subset2);
        rowsOut.push({
          key: n2Key,
          level: 3,
          type: "n2",
          label: n2Value,
          n0: subset2[0].n0 || "",
          n1: n1Value,
          n2: n2Value,
          n3: "",
          status: statusFromDates(kn2.exe, dt2.end),
          con: kn2.con,
          dia: kn2.dia,
          atr: kn2.atr,
          exe: kn2.exe,
          exeObj: kn2.exeObj,
          deadline: dt2.end,
        });

        const n3Values = localeSort(
          Array.from(new Set(subset2.map((d) => d.n3 || ""))).filter(Boolean),
        );
        if (n3Values.length) {
          n3Values.forEach((n3Value) => {
            const subset3 = subset2.filter((d) => d.n3 === n3Value);
            const n3Key = `n3_${encodeURIComponent(n1Value)}_${encodeURIComponent(n2Value)}_${encodeURIComponent(n3Value)}`;
            const kn3 = kpi(subset3);
            rowsOut.push({
              key: n3Key,
              level: 4,
              type: "n3",
              label: n3Value,
              n0: subset3[0].n0 || "",
              n1: n1Value,
              n2: n2Value,
              n3: n3Value,
              status: statusFromLeaves(subset3),
              con: kn3.con,
              dia: kn3.dia,
              atr: kn3.atr,
              exe: kn3.exe,
              exeObj: kn3.exeObj,
              deadline: datesFromN4(subset3).end,
            });

            subset3.forEach((activity) => {
              const rowKey = `n4_${encodeURIComponent(activity.n1 || "")}_${encodeURIComponent(activity.n2 || "")}_${encodeURIComponent(activity.n3 || "")}_${encodeURIComponent(activity.nome || "")}`;
              rowsOut.push({
                key: rowKey,
                level: 5,
                type: "n4",
                label: activity.nome || "—",
                n0: activity.n0 || "",
                n1: activity.n1 || "",
                n2: activity.n2 || "",
                n3: activity.n3 || "",
                status: activity.status || "",
                con: 0,
                dia: 0,
                atr: 0,
                exe: activity.pct || 0,
                exeObj: activity.pct_prev || 0,
                deadline: activity.rf || activity.bf || null,
                activity,
              });
            });
          });
        } else {
          subset2.forEach((activity) => {
            const rowKey = `n4_${encodeURIComponent(activity.n1 || "")}_${encodeURIComponent(activity.n2 || "")}_${encodeURIComponent(activity.n3 || "")}_${encodeURIComponent(activity.nome || "")}`;
            rowsOut.push({
              key: rowKey,
              level: 4,
              type: "n4",
              label: activity.nome || "—",
              n0: activity.n0 || "",
              n1: activity.n1 || "",
              n2: activity.n2 || "",
              n3: activity.n3 || "",
              status: activity.status || "",
              con: 0,
              dia: 0,
              atr: 0,
              exe: activity.pct || 0,
              exeObj: activity.pct_prev || 0,
              deadline: activity.rf || activity.bf || null,
              activity,
            });
          });
        }
      });
    };

    if (hasMultiN0) {
      const n0ValuesSorted = localeSort(n0Values);
      n0ValuesSorted.forEach((n0Value) => {
        const subset0 = filteredActivities.filter((d) => d.n0 === n0Value);
        const n0Key = `n0_${encodeURIComponent(n0Value)}`;
        const kn0 = kpi(subset0);
        const dt0 = datesFromN4(subset0);
        rowsOut.push({
          key: n0Key,
          level: 1,
          type: "n0",
          label: n0Value,
          n0: n0Value,
          n1: "",
          n2: "",
          n3: "",
          status: statusFromDates(kn0.exe, dt0.end),
          con: kn0.con,
          dia: kn0.dia,
          atr: kn0.atr,
          exe: kn0.exe,
          exeObj: kn0.exeObj,
          deadline: dt0.end,
        });

        const n1Values = localeSort(
          Array.from(new Set(subset0.map((d) => d.n1 || ""))).filter(Boolean),
        );
        n1Values.forEach((n1Value) =>
          renderN1Block(
            n1Value,
            subset0.filter((d) => d.n1 === n1Value),
          ),
        );
      });
    } else {
      const n1Values = localeSort(
        Array.from(new Set(filteredActivities.map((d) => d.n1 || ""))).filter(
          Boolean,
        ),
      );
      n1Values.forEach((n1Value) =>
        renderN1Block(
          n1Value,
          filteredActivities.filter((d) => d.n1 === n1Value),
        ),
      );
    }

    return rowsOut;
  }, [filteredActivities]);

  const toggleRow = (key: string) => {
    const next = new Set(collapsedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setCollapsedKeys(next);
  };

  const collapseAll = () => {
    const next = new Set<string>();
    rows.forEach((row) => {
      if (row.type === "n1" || row.type === "n2" || row.type === "n3") {
        next.add(row.key);
      }
      if (row.type === "n0") {
        next.add(row.key);
      }
    });
    setCollapsedKeys(next);
  };

  const expandAll = () => {
    setCollapsedKeys(new Set());
  };

  const formatDate = (value: string | null) => {
    if (!value) return "—";
    const parts = value.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return value;
  };

  const formatPercent = (value: number) => `${Math.round(value)}%`;

  const getBadgeClass = (status: string) => {
    if (status === "Concluído") return "badge badge-done";
    if (status === "Em atraso") return "badge badge-late";
    return "badge badge-ok";
  };

  const shouldRenderRow = (row: ActivityRow) => {
    if (row.type === "n0") return true;
    if (row.type === "n1") {
      return !collapsedKeys.has(`n0_${encodeURIComponent(row.n0)}`);
    }
    if (row.type === "n2") {
      return (
        !collapsedKeys.has(`n1_${encodeURIComponent(row.n1)}`) &&
        !collapsedKeys.has(`n0_${encodeURIComponent(row.n0)}`)
      );
    }
    if (row.type === "n3") {
      return (
        !collapsedKeys.has(
          `n2_${encodeURIComponent(row.n1)}_${encodeURIComponent(row.n2)}`,
        ) &&
        !collapsedKeys.has(`n1_${encodeURIComponent(row.n1)}`) &&
        !collapsedKeys.has(`n0_${encodeURIComponent(row.n0)}`)
      );
    }
    if (row.type === "n4") {
      if (row.n3) {
        return (
          !collapsedKeys.has(
            `n3_${encodeURIComponent(row.n1)}_${encodeURIComponent(row.n2)}_${encodeURIComponent(row.n3)}`,
          ) &&
          !collapsedKeys.has(
            `n2_${encodeURIComponent(row.n1)}_${encodeURIComponent(row.n2)}`,
          ) &&
          !collapsedKeys.has(`n1_${encodeURIComponent(row.n1)}`) &&
          !collapsedKeys.has(`n0_${encodeURIComponent(row.n0)}`)
        );
      }
      return (
        !collapsedKeys.has(
          `n2_${encodeURIComponent(row.n1)}_${encodeURIComponent(row.n2)}`,
        ) &&
        !collapsedKeys.has(`n1_${encodeURIComponent(row.n1)}`) &&
        !collapsedKeys.has(`n0_${encodeURIComponent(row.n0)}`)
      );
    }
    return true;
  };

  if (loading) {
    return (
      <section className="card">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Carregando atividades...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card">
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <p>Erro ao carregar atividades: {error.message}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="card act-page-card">
      <div className="act-toolbar">
        <div className="card-title">Atividades</div>
        <div className="act-buttons">
          <button className="btn" onClick={collapseAll}>
            Colapsar tudo
          </button>
          <button className="btn" onClick={expandAll}>
            Expandir tudo
          </button>
        </div>
      </div>

      <div className="act-search-bar">
        <input
          id="act-search"
          type="text"
          className="act-search-input"
          placeholder="Pesquisar atividades..."
          value={searchQuery}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setSearchQuery(event.target.value)
          }
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === "Escape") {
              setSearchQuery("");
              (event.target as HTMLInputElement).blur();
            }
          }}
        />
      </div>

      <div className="status-chips">
        <button
          className={`status-chip ${!statusFilter ? "active" : ""}`}
          onClick={() => setStatusFilter(null)}
        >
          Todas {statusCounts.total}
        </button>
        <button
          className={`status-chip chip-done ${statusFilter === "Concluído" ? "active" : ""}`}
          onClick={() => setStatusFilter("Concluído")}
        >
          Concluídas {statusCounts.completed}
        </button>
        <button
          className={`status-chip chip-ok ${statusFilter === "Em dia" ? "active" : ""}`}
          onClick={() => setStatusFilter("Em dia")}
        >
          Em dia {statusCounts.onTime}
        </button>
        <button
          className={`status-chip chip-late ${statusFilter === "Em atraso" ? "active" : ""}`}
          onClick={() => setStatusFilter("Em atraso")}
        >
          Em atraso {statusCounts.late}
        </button>
      </div>

      <div className="act-table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col" style={{ minWidth: "240px" }}>
                Designação
              </th>
              <th scope="col" className="c" style={{ minWidth: "80px" }}>
                Estado
              </th>
              <th scope="col" className="c" style={{ minWidth: "90px" }}>
                C / D / A
              </th>
              <th scope="col" className="c" style={{ minWidth: "160px" }}>
                Exec. real / prev.
              </th>
              <th scope="col" className="c" style={{ whiteSpace: "nowrap" }}>
                Prazo
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    textAlign: "center",
                    color: "var(--text2)",
                    padding: "2rem",
                  }}
                >
                  Nenhuma actividade encontrada.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                if (!shouldRenderRow(row)) return null;
                const collapsed = collapsedKeys.has(row.key);
                const hasChildren = row.type !== "n4";
                return (
                  <tr key={row.key} className={`act-${row.type} hover-row`}>
                    <td className="act-name-cell">
                      <div className="act-name-content">
                        {hasChildren ? (
                          <button
                            className="act-toggle"
                            type="button"
                            onClick={() => toggleRow(row.key)}
                          >
                            {collapsed ? "▶" : "▼"}
                          </button>
                        ) : null}
                        <span
                          className={
                            row.type === "n0" ? "act-root-label" : undefined
                          }
                        >
                          {row.label || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="c">
                      {row.status ? (
                        <span className={getBadgeClass(row.status)}>
                          {row.status}
                        </span>
                      ) : null}
                    </td>
                    <td className="c">
                      {row.type === "n4" ? null : (
                        <span style={{ fontSize: "11px" }}>
                          <span style={{ color: "var(--blue)" }}>
                            {row.con}C
                          </span>
                          &nbsp;
                          <span style={{ color: "var(--green)" }}>
                            {row.dia}D
                          </span>
                          &nbsp;
                          <span style={{ color: "var(--red)" }}>
                            {row.atr}A
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="c">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          justifyContent: "center",
                        }}
                      >
                        <div
                          style={{
                            width: "90px",
                            position: "relative",
                            height: "10px",
                            borderRadius: "3px",
                            overflow: "hidden",
                            background: "var(--bg3)",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: `${Math.min(100, Math.max(0, row.exeObj))}%`,
                              height: "100%",
                              background: "var(--green)",
                              opacity: 0.3,
                              borderRadius: "3px",
                            }}
                          ></div>
                          <div
                            style={{
                              position: "absolute",
                              top: "1px",
                              left: 0,
                              width: `${Math.min(100, Math.max(0, row.exe))}%`,
                              height: "8px",
                              background:
                                row.type === "n4"
                                  ? "var(--navy)"
                                  : "var(--navy)",
                              borderRadius: "3px",
                            }}
                          ></div>
                        </div>
                        <span
                          style={{
                            fontSize: "10px",
                            minWidth: "50px",
                            textAlign: "left",
                            color: "var(--text2)",
                          }}
                        >
                          {formatPercent(row.exe)}
                          <span style={{ color: "var(--text3)" }}>
                            / {formatPercent(row.exeObj)}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td
                      className="c act-deadline-cell"
                      style={{
                        color:
                          row.deadline && new Date(row.deadline) < new Date()
                            ? "var(--red)"
                            : "var(--text2)",
                      }}
                    >
                      {formatDate(row.deadline)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

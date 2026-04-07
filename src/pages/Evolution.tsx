import React, { useMemo, useState } from 'react';
import { useFilters } from '../context/FilterContext';
import { useActivities } from '../hooks/useSupabase';
import { useSnapshots } from '../hooks/useSupabase';
import type { Activity, Snapshot } from '../types';

// Utility function to calculate KPIs for a set of activities
function calculateKPIs(activities: Activity[]) {
    const total = activities.length;
    if (total === 0) return { n: 0, con: 0, dia: 0, atr: 0, exe: 0, cg: 0, cd: 0 };

    const con = activities.filter(a => a.status === 'Concluído').length;
    const atr = activities.filter(a => a.status === 'Em atraso').length;
    const dia = activities.filter(a => a.status === 'Em dia').length;

    const exe = activities.reduce((sum, a) => sum + (a.pct || 0), 0) / total;
    const cg = con / total;
    const cd = (con + atr) > 0 ? con / (con + atr) : 0;

    return { n: total, con, dia, atr, exe, cg, cd };
}

// Get KPI from snapshot for specific grouping
function getSnapshotKPI(snapshot: Snapshot | null, n0?: string, n1?: string, n2?: string): any {
    if (!snapshot) return { n: 0, con: 0, dia: 0, atr: 0, exe: 0, cg: 0, cd: 0 };

    const byN1 = snapshot.byN1 as any;
    const byN0 = snapshot.byN0 as any;

    if (n2 && byN1?.[n1 || '']?.byN2?.[n2]) {
        return byN1[n1 || ''].byN2[n2];
    }
    if (n1 && byN1?.[n1]) {
        return byN1[n1].kpi || byN1[n1];
    }
    if (n0 && byN0?.[n0]) {
        return byN0[n0];
    }
    return snapshot.kpis as any || { n: 0, con: 0, dia: 0, atr: 0, exe: 0, cg: 0, cd: 0 };
}

// Render table rows for evolution comparison
function renderEvolutionTableRows(
    activities: Activity[],
    snapshotB: Snapshot | null,
    viewMode: 'eixo' | 'all'
): React.JSX.Element[] {
    const n0s = [...new Set(activities.map(a => a.n0 || ''))].filter(Boolean);
    const hasMultiN0 = n0s.length > 1;

    const rows: React.JSX.Element[] = [];

    if (hasMultiN0) {
        n0s.forEach(n0 => {
            const n0Activities = activities.filter(a => a.n0 === n0);
            const currentKPI = calculateKPIs(n0Activities);
            const prevKPI = getSnapshotKPI(snapshotB, n0);

            rows.push(renderTableRow(`<strong>${n0}</strong>`, currentKPI, prevKPI, 4, 'row-n1'));

            const n1s = [...new Set(n0Activities.map(a => a.n1))].sort();
            n1s.forEach(n1 => {
                const n1Activities = n0Activities.filter(a => a.n1 === n1);
                const n1CurrentKPI = calculateKPIs(n1Activities);
                const n1PrevKPI = getSnapshotKPI(snapshotB, n0, n1);

                rows.push(renderTableRow(n1, n1CurrentKPI, n1PrevKPI, 18, 'row-n1'));

                if (viewMode === 'all') {
                    const n2s = [...new Set(n1Activities.map(a => a.n2))].filter(Boolean).sort();
                    n2s.forEach(n2 => {
                        const n2Activities = n1Activities.filter(a => a.n2 === n2);
                        const n2CurrentKPI = calculateKPIs(n2Activities);
                        const n2PrevKPI = getSnapshotKPI(snapshotB, n0, n1, n2);

                        rows.push(renderTableRow(n2, n2CurrentKPI, n2PrevKPI, 30, 'row-n2'));
                    });
                }
            });
        });
    } else {
        const n1s = [...new Set(activities.map(a => a.n1))].sort();
        n1s.forEach(n1 => {
            const n1Activities = activities.filter(a => a.n1 === n1);
            const currentKPI = calculateKPIs(n1Activities);
            const prevKPI = getSnapshotKPI(snapshotB, n0s[0], n1);

            rows.push(renderTableRow(n1, currentKPI, prevKPI, 10, 'row-n1'));

            if (viewMode === 'all') {
                const n2s = [...new Set(n1Activities.map(a => a.n2))].filter(Boolean).sort();
                n2s.forEach(n2 => {
                    const n2Activities = n1Activities.filter(a => a.n2 === n2);
                    const n2CurrentKPI = calculateKPIs(n2Activities);
                    const n2PrevKPI = getSnapshotKPI(snapshotB, n0s[0], n1, n2);

                    rows.push(renderTableRow(n2, n2CurrentKPI, n2PrevKPI, 22, 'row-n2'));
                });
            }
        });
    }

    return rows;
}

// Render a single table row
function renderTableRow(
    label: string,
    currentKPI: any,
    prevKPI: any,
    indent: number,
    className: string
) {
    const getDelta = (current: number, previous: number, isLowerBetter = false) => {
        const delta = current - previous;
        if (delta === 0) return <span style={{ color: 'var(--text3)' }}>—</span>;

        const isGood = isLowerBetter ? delta < 0 : delta > 0;
        const arrow = delta > 0 ? '↑' : '↓';
        const color = isGood ? 'var(--green)' : 'var(--red)';

        return (
            <span style={{ color, fontSize: '12px' }}>
                {arrow} {Math.abs(Math.round(delta))}
            </span>
        );
    };

    return (
        <tr key={label} className={className}>
            <td style={{ paddingLeft: `${indent}px` }}>
                <span dangerouslySetInnerHTML={{ __html: label }} />
            </td>
            {/* Concluídas */}
            <td className="c" style={{ borderLeft: '1px solid var(--border)', color: 'var(--blue)' }}>
                {currentKPI.con}
            </td>
            {prevKPI ? (
                <>
                    <td className="c" style={{ color: 'var(--text2)' }}>{prevKPI.con || 0}</td>
                    <td className="c">{getDelta(currentKPI.con, prevKPI.con || 0)}</td>
                </>
            ) : null}

            {/* Em dia */}
            <td className="c" style={{ borderLeft: '1px solid var(--border)', color: 'var(--green)' }}>
                {currentKPI.dia}
            </td>
            {prevKPI ? (
                <>
                    <td className="c" style={{ color: 'var(--text2)' }}>{prevKPI.dia || 0}</td>
                    <td className="c">{getDelta(currentKPI.dia, prevKPI.dia || 0)}</td>
                </>
            ) : null}

            {/* Em atraso */}
            <td className="c" style={{ borderLeft: '1px solid var(--border)', color: 'var(--red)' }}>
                {currentKPI.atr}
            </td>
            {prevKPI ? (
                <>
                    <td className="c" style={{ color: 'var(--text2)' }}>{prevKPI.atr || 0}</td>
                    <td className="c">{getDelta(currentKPI.atr, prevKPI.atr || 0, true)}</td>
                </>
            ) : null}

            {/* Total */}
            <td className="c" style={{ borderLeft: '1px solid var(--border)' }}>
                {currentKPI.n}
            </td>
            {prevKPI ? (
                <>
                    <td className="c" style={{ color: 'var(--text2)' }}>{prevKPI.n || 0}</td>
                    <td className="c">{getDelta(currentKPI.n, prevKPI.n || 0)}</td>
                </>
            ) : null}
        </tr>
    );
}

export default function Evolution() {
    const { n0, n1 } = useFilters();
    const { data: activities, loading: activitiesLoading, error: activitiesError } = useActivities({ n0, n1 });
    const { data: snapshots, loading: snapshotsLoading, error: snapshotsError } = useSnapshots();

    const [selectedSnapshotA, setSelectedSnapshotA] = useState<string>('current');
    const [selectedSnapshotB, setSelectedSnapshotB] = useState<string>('');
    const [viewMode, setViewMode] = useState<'eixo' | 'all'>('eixo');

    // Calculate KPIs for current data
    const currentKPIs = useMemo(() => {
        if (!activities) return null;

        const total = activities.length;
        if (total === 0) return { n: 0, con: 0, dia: 0, atr: 0, exe: 0, cg: 0, cd: 0 };

        const con = activities.filter(a => a.status === 'Concluído').length;
        const atr = activities.filter(a => a.status === 'Em atraso').length;
        const dia = activities.filter(a => a.status === 'Em dia').length;

        const exe = activities.reduce((sum, a) => sum + (a.pct || 0), 0) / total;
        const cg = con / total;
        const cd = (con + atr) > 0 ? con / (con + atr) : 0;

        return { n: total, con, dia, atr, exe, cg, cd };
    }, [activities]);

    // Get selected snapshots
    const snapshotA = useMemo(() => {
        if (selectedSnapshotA === 'current') return null;
        return snapshots?.find(s => s._supabase_id === selectedSnapshotA) || null;
    }, [snapshots, selectedSnapshotA]);

    const snapshotB = useMemo(() => {
        if (!selectedSnapshotB) return null;
        return snapshots?.find(s => s._supabase_id === selectedSnapshotB) || null;
    }, [snapshots, selectedSnapshotB]);

    // Filter activities based on current filters for comparison
    const filteredActivities = useMemo(() => {
        if (!activities) return [];
        let filtered = activities;

        if (n0) {
            filtered = filtered.filter(a => a.n0 === n0);
        }
        if (n1) {
            filtered = filtered.filter(a => a.n1 === n1);
        }

        return filtered;
    }, [activities, n0, n1]);

    const formatPercent = (value: number) => `${(Math.round(value * 10) / 10).toFixed(1)}%`;

    const formatNumber = (value: number) => value.toString();

    const getDelta = (current: number, previous: number, isLowerBetter = false) => {
        const delta = current - previous;
        if (delta === 0) return <span style={{ color: 'var(--text3)' }}>—</span>;

        const isGood = isLowerBetter ? delta < 0 : delta > 0;
        const arrow = delta > 0 ? '↑' : '↓';
        const color = isGood ? 'var(--green)' : 'var(--red)';

        return (
            <span style={{ color, fontSize: '12px' }}>
                {arrow} {Math.abs(Math.round(delta))}
            </span>
        );
    };

    const loading = activitiesLoading || snapshotsLoading;
    const error = activitiesError || snapshotsError;

    if (loading) {
        return (
            <section className="card">
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Carregando evolução...</p>
                </div>
            </section>
        );
    }

    if (error) {
        return (
            <section className="card">
                <div className="empty-state">
                    <div className="empty-state-icon">⚠️</div>
                    <p>Erro ao carregar dados: {error.message}</p>
                </div>
            </section>
        );
    }

    return (
        <section className="card">
            <h1>Evolução</h1>

            {/* Toolbar */}
            <div className="pm-toolbar">
                <div className="pm-sel-wrap">
                    <span className="pm-sel-lbl">Data A</span>
                    <select
                        className="pm-sel"
                        value={selectedSnapshotA}
                        onChange={(e) => setSelectedSnapshotA(e.target.value)}
                    >
                        <option value="current">Dados actuais</option>
                        {snapshots?.map(snapshot => (
                            <option key={snapshot._supabase_id} value={snapshot._supabase_id}>
                                {snapshot.label}
                            </option>
                        ))}
                    </select>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text3)' }}>vs</span>
                <div className="pm-sel-wrap">
                    <span className="pm-sel-lbl">Data B</span>
                    <select
                        className="pm-sel"
                        value={selectedSnapshotB}
                        onChange={(e) => setSelectedSnapshotB(e.target.value)}
                    >
                        <option value="">— seleccionar —</option>
                        {snapshots?.map(snapshot => (
                            <option key={snapshot._supabase_id} value={snapshot._supabase_id}>
                                {snapshot.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                    <button className="btn" style={{ fontSize: '12px' }}>
                        &#128190; Guardar snapshot
                    </button>
                </div>
            </div>

            {/* KPI Comparison Cards */}
            {currentKPIs && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                    gap: '8px',
                    marginBottom: '1.25rem'
                }}>
                    {[
                        { lbl: 'Total', cur: currentKPIs.n, prev: snapshotB?.kpis?.n || 0, fmt: formatNumber, neutral: true },
                        { lbl: 'Concluídas', cur: currentKPIs.con, prev: snapshotB?.kpis?.con || 0, fmt: formatNumber },
                        { lbl: 'Em dia', cur: currentKPIs.dia, prev: snapshotB?.kpis?.dia || 0, fmt: formatNumber },
                        { lbl: 'Em atraso', cur: currentKPIs.atr, prev: snapshotB?.kpis?.atr || 0, fmt: formatNumber, lower: true },
                        { lbl: 'Execução', cur: currentKPIs.exe, prev: snapshotB?.kpis?.exe || 0, fmt: formatPercent },
                        { lbl: 'Conc. geral', cur: currentKPIs.cg * 100, prev: (snapshotB?.kpis?.cg as number || 0) * 100, fmt: formatPercent },
                        { lbl: 'Conc. data', cur: currentKPIs.cd * 100, prev: (snapshotB?.kpis?.cd as number || 0) * 100, fmt: formatPercent },
                    ].map((kpi, index) => (
                        <div key={index} className="kpi">
                            <div className="kpi-lbl">{kpi.lbl}</div>
                            <div className="kpi-val" style={{ color: 'var(--navy)' }}>
                                {kpi.fmt(kpi.cur)}
                            </div>
                            {snapshotB ? (
                                <>
                                    <div style={{ marginTop: '5px', fontSize: '11px', color: 'var(--text2)' }}>
                                        {kpi.fmt(kpi.prev as number)} <span style={{ color: 'var(--text3)' }}>({snapshotB.label})</span>
                                    </div>
                                    <div style={{ marginTop: '2px' }}>
                                        {!kpi.neutral && getDelta(kpi.cur, kpi.prev as number, kpi.lower)}
                                    </div>
                                </>
                            ) : (
                                <div style={{ marginTop: '5px', fontSize: '11px', color: 'var(--text3)' }}>
                                    Selecciona Data B para comparar
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Detail Comparison Table */}
            {currentKPIs && (
                <div className="card" style={{ padding: '1rem 1.25rem' }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '1rem',
                        flexWrap: 'wrap',
                        gap: '8px'
                    }}>
                        <div className="card-title" style={{ marginBottom: 0 }}>
                            {(selectedSnapshotA === 'current' ? 'Actual' : snapshotA?.label || 'Actual')}
                            {snapshotB && ` vs ${snapshotB.label}`}
                        </div>
                        <div className="chip-row" style={{ marginBottom: 0 }}>
                            <button
                                className={`chip ${viewMode === 'eixo' ? 'active' : ''}`}
                                onClick={() => setViewMode('eixo')}
                            >
                                Eixo
                            </button>
                            <button
                                className={`chip ${viewMode === 'all' ? 'active' : ''}`}
                                onClick={() => setViewMode('all')}
                            >
                                Eixo + Plano
                            </button>
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th rowSpan={2}>
                                        Programa / Eixo{viewMode === 'all' ? ' / Plano' : ''}
                                    </th>
                                    {snapshotB ? (
                                        <>
                                            <th colSpan={3} style={{ textAlign: 'center', borderLeft: '1px solid var(--border)', color: 'var(--blue)' }}>
                                                Concluídas
                                            </th>
                                            <th colSpan={3} style={{ textAlign: 'center', borderLeft: '1px solid var(--border)', color: 'var(--green)' }}>
                                                Em dia
                                            </th>
                                            <th colSpan={3} style={{ textAlign: 'center', borderLeft: '1px solid var(--border)', color: 'var(--red)' }}>
                                                Em atraso
                                            </th>
                                            <th colSpan={3} style={{ textAlign: 'center', borderLeft: '1px solid var(--border)' }}>
                                                Total
                                            </th>
                                        </>
                                    ) : (
                                        <>
                                            <th style={{ textAlign: 'center', borderLeft: '1px solid var(--border)', color: 'var(--blue)' }}>
                                                Conc.
                                            </th>
                                            <th style={{ textAlign: 'center', borderLeft: '1px solid var(--border)', color: 'var(--green)' }}>
                                                Em dia
                                            </th>
                                            <th style={{ textAlign: 'center', borderLeft: '1px solid var(--border)', color: 'var(--red)' }}>
                                                Atraso
                                            </th>
                                            <th style={{ textAlign: 'center', borderLeft: '1px solid var(--border)' }}>
                                                Total
                                            </th>
                                        </>
                                    )}
                                </tr>
                                {snapshotB && (
                                    <tr>
                                        {['', '', '', ''].map((_, i) => (
                                            <React.Fragment key={i}>
                                                <th className="c" style={{ fontSize: '10px', borderLeft: '1px solid var(--border)' }}>
                                                    {(selectedSnapshotA === 'current' ? 'Actual' : snapshotA?.label || 'Actual').substring(0, 8)}
                                                </th>
                                                <th className="c" style={{ fontSize: '10px' }}>
                                                    {snapshotB.label.substring(0, 8)}
                                                </th>
                                                <th className="c" style={{ fontSize: '10px' }}>Δ</th>
                                            </React.Fragment>
                                        ))}
                                    </tr>
                                )}
                            </thead>
                            <tbody>
                                {renderEvolutionTableRows(filteredActivities, snapshotB, viewMode)}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </section>
    );
}

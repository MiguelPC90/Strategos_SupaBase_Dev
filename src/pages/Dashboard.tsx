import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useFilters } from '../context/FilterContext';
import { useActivities } from '../hooks/useSupabase';
import type { Activity } from '../types';
import Chart from 'chart.js/auto';

export default function Dashboard() {
    const { n0, n1 } = useFilters();
    const { data: activities, loading, error } = useActivities({ n0, n1 });
    const barChartRef = useRef<HTMLCanvasElement>(null);
    const donutChartRef = useRef<HTMLCanvasElement>(null);
    const barChartInstance = useRef<Chart | null>(null);
    const donutChartInstance = useRef<Chart | null>(null);

    // Calculate KPIs
    const kpis = useMemo(() => {
        if (!activities) return null;

        const total = activities.length;
        if (total === 0) return { total: 0, completed: 0, onTime: 0, late: 0, execution: 0, executionObj: 0, concretization: 0, concretizationObj: 0, concretizationDate: 0 };

        const completed = activities.filter(a => a.status === 'Concluído').length;
        const late = activities.filter(a => a.status === 'Em atraso').length;
        const onTime = activities.filter(a => a.status === 'Em dia').length;

        const execution = activities.reduce((sum, a) => sum + (a.pct || 0), 0) / total;
        const executionObj = activities.reduce((sum, a) => sum + (a.pct_prev || 0), 0) / total;

        const concretization = completed / total;
        const concretizationObj = (completed + late) / total;
        const concretizationDate = (completed + late) > 0 ? completed / (completed + late) : 0;

        return {
            total,
            completed,
            onTime,
            late,
            execution,
            executionObj,
            concretization,
            concretizationObj,
            concretizationDate
        };
    }, [activities]);

    // Group activities by N1 and N2
    const groupedActivities = useMemo(() => {
        if (!activities) return [];

        const n1Map = new Map<string, Activity[]>();

        activities.forEach(activity => {
            const key = `${activity.n0 || ''}|||${activity.n1 || activity.n0 || '—'}`;
            if (!n1Map.has(key)) {
                n1Map.set(key, []);
            }
            n1Map.get(key)!.push(activity);
        });

        // Sort by N1 key (numeric sorting)
        const sortedKeys = Array.from(n1Map.keys()).sort((a, b) =>
            a.localeCompare(b, 'pt', { numeric: true, sensitivity: 'base' })
        );

        return sortedKeys.map(key => {
            const items = n1Map.get(key)!;
            const completed = items.filter(a => a.status === 'Concluído').length;
            const late = items.filter(a => a.status === 'Em atraso').length;
            const execution = items.reduce((sum, a) => sum + (a.pct || 0), 0) / items.length;

            // Group by N2
            const n2Map = new Map<string, Activity[]>();
            items.forEach(activity => {
                const n2Key = activity.n2 || '—';
                if (!n2Map.has(n2Key)) {
                    n2Map.set(n2Key, []);
                }
                n2Map.get(n2Key)!.push(activity);
            });

            const n2Groups = Array.from(n2Map.keys())
                .sort((a, b) => a.localeCompare(b, 'pt', { numeric: true }))
                .map(n2Key => {
                    const n2Items = n2Map.get(n2Key)!;
                    const n2Completed = n2Items.filter(a => a.status === 'Concluído').length;
                    const n2Late = n2Items.filter(a => a.status === 'Em atraso').length;
                    const n2Execution = n2Items.reduce((sum, a) => sum + (a.pct || 0), 0) / n2Items.length;

                    return {
                        n2: n2Key,
                        activities: n2Items,
                        completed: n2Completed,
                        late: n2Late,
                        execution: n2Execution
                    };
                });

            return {
                key,
                n0: key.split('|||')[0] || '',
                n1: key.split('|||')[1] || '—',
                activities: items,
                completed,
                late,
                execution,
                n2Groups
            };
        });
    }, [activities]);

    // Initialize charts
    useEffect(() => {
        if (!kpis || !barChartRef.current || !donutChartRef.current) return;

        // Destroy existing chart instances
        if (barChartInstance.current) {
            barChartInstance.current.destroy();
        }
        if (donutChartInstance.current) {
            donutChartInstance.current.destroy();
        }

        // Get bar chart data from groupedActivities
        const eixoLabels = groupedActivities.map(g => g.n1);
        const completedData = groupedActivities.map(g => g.completed);
        const lateData = groupedActivities.map(g => g.late);
        const onTimeData = groupedActivities.map(g => 
            g.activities.length - g.completed - g.late
        );

        // Bar Chart
        const barCtx = barChartRef.current.getContext('2d');
        if (barCtx) {
            barChartInstance.current = new Chart(barCtx, {
                type: 'bar',
                data: {
                    labels: eixoLabels,
                    datasets: [
                        {
                            label: 'Concluído',
                            data: completedData,
                            backgroundColor: '#95BB42',
                            borderColor: '#95BB42',
                            borderWidth: 1
                        },
                        {
                            label: 'Em dia',
                            data: onTimeData,
                            backgroundColor: '#002E5E',
                            borderColor: '#002E5E',
                            borderWidth: 1
                        },
                        {
                            label: 'Atrasado',
                            data: lateData,
                            backgroundColor: '#D94F3D',
                            borderColor: '#D94F3D',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: 'bottom' as const,
                            labels: {
                                boxWidth: 12,
                                padding: 12,
                                font: { size: 12 }
                            }
                        },
                        title: {
                            display: true,
                            text: 'Atividades por Eixo',
                            font: { size: 14, weight: 'bold' }
                        }
                    },
                    scales: {
                        x: {
                            stacked: false,
                            ticks: { font: { size: 11 } }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: { font: { size: 11 } }
                        }
                    }
                }
            });
        }

        // Donut Chart
        const donutCtx = donutChartRef.current.getContext('2d');
        if (donutCtx) {
            donutChartInstance.current = new Chart(donutCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Concluído', 'Em dia', 'Atrasado'],
                    datasets: [
                        {
                            data: [
                                kpis.completed,
                                kpis.onTime,
                                kpis.late
                            ],
                            backgroundColor: ['#95BB42', '#002E5E', '#D94F3D'],
                            borderColor: ['#95BB42', '#002E5E', '#D94F3D'],
                            borderWidth: 2,
                            hoverOffset: 4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: 'bottom' as const,
                            labels: {
                                boxWidth: 12,
                                padding: 12,
                                font: { size: 12 }
                            }
                        },
                        title: {
                            display: true,
                            text: 'Distribuição Global',
                            font: { size: 14, weight: 'bold' }
                        }
                    }
                }
            });
        }

        return () => {
            if (barChartInstance.current) {
                barChartInstance.current.destroy();
            }
            if (donutChartInstance.current) {
                donutChartInstance.current.destroy();
            }
        };
    }, [kpis, groupedActivities]);

    const formatPercent = (value: number) => `${(Math.round(value * 10) / 10).toFixed(1)}%`;

    const getStatusBadge = (completed: number, late: number, total: number) => {
        if (late > 0) return <span className="badge badge-late">{late} atraso</span>;
        if (completed === total) return <span className="badge badge-done">Concluído</span>;
        return <span className="badge badge-ok">Em dia</span>;
    };

    const getProgressBarClass = (late: number, completed: number, total: number) => {
        if (late > 0) return 'progress-bar late';
        if (completed === total) return 'progress-bar done';
        return 'progress-bar';
    };

    if (loading) {
        return (
            <section className="card">
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Carregando dashboard...</p>
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

    if (!kpis || kpis.total === 0) {
        return (
            <section className="card">
                <div className="empty-state">
                    <div className="empty-state-icon">📭</div>
                    <p>Sem actividades para mostrar</p>
                </div>
            </section>
        );
    }

    return (
        <section className="card">
            <h1>Dashboard</h1>
            <p>Filtro atual: <strong>{n0 || 'Todos N0'}</strong> / <strong>{n1 || 'Todos N1'}</strong></p>

            {/* KPI Grid */}
            <div className="kpi-grid">
                <div className="kpi-card">
                    <div className="kpi-label">Execução</div>
                    <div className={`kpi-value ${kpis.execution >= 75 ? 'green' : kpis.execution < 40 ? 'danger' : ''}`}>
                        {formatPercent(kpis.execution)}
                    </div>
                    <div className="kpi-sub">{kpis.total} actividades</div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-label">Concluídas</div>
                    <div className="kpi-value green">{kpis.completed}</div>
                    <div className="kpi-sub">{formatPercent(kpis.concretization)}</div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-label">Em dia</div>
                    <div className="kpi-value">{kpis.onTime}</div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-label">Em atraso</div>
                    <div className={`kpi-value ${kpis.late > 0 ? 'danger' : ''}`}>{kpis.late}</div>
                </div>
            </div>

            {/* Concretization Grid */}
            <div className="section-title" style={{ marginTop: '4px' }}>Concretização</div>
            <div className="conc-grid">
                <div className="conc-row-label">Grau de execução</div>
                <div className="conc-card">
                    <div className="conc-label">Real</div>
                    <div className="conc-value">{formatPercent(kpis.execution)}</div>
                </div>
                <div className="conc-card obj">
                    <div className="conc-label">Objectivo</div>
                    <div className="conc-value">{formatPercent(kpis.executionObj)}</div>
                </div>

                <div className="conc-row-label">Concretização geral</div>
                <div className="conc-card">
                    <div className="conc-label">Real</div>
                    <div className="conc-value">{formatPercent(kpis.concretization * 100)}</div>
                </div>
                <div className="conc-card obj">
                    <div className="conc-label">Objectivo</div>
                    <div className="conc-value">{formatPercent(kpis.concretizationObj * 100)}</div>
                </div>

                <div className="conc-row-label">Concretização à data</div>
                <div className="conc-card">
                    <div className="conc-label">Real</div>
                    <div className="conc-value">{formatPercent(kpis.concretizationDate * 100)}</div>
                </div>
                <div className="conc-card obj">
                    <div className="conc-label">Meta</div>
                    <div className="conc-value">100%</div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="charts-row" style={{ marginTop: '20px' }}>
                <div className="chart-container" style={{ flex: '1.5', minHeight: '300px' }}>
                    <canvas ref={barChartRef}></canvas>
                </div>
                <div className="chart-container" style={{ flex: '1', minHeight: '300px' }}>
                    <canvas ref={donutChartRef}></canvas>
                </div>
            </div>

            {/* Programs Section */}
            <div className="section-title">Por programa / eixo</div>
            {groupedActivities.map((group, index) => (
                <ProgramCard
                    key={group.key}
                    group={group}
                    isExpandedByDefault={index === 0}
                    formatPercent={formatPercent}
                    getStatusBadge={getStatusBadge}
                    getProgressBarClass={getProgressBarClass}
                />
            ))}
        </section>
    );
}

interface ProgramCardProps {
    group: {
        key: string;
        n0: string;
        n1: string;
        activities: Activity[];
        completed: number;
        late: number;
        execution: number;
        n2Groups: Array<{
            n2: string;
            activities: Activity[];
            completed: number;
            late: number;
            execution: number;
        }>;
    };
    isExpandedByDefault: boolean;
    formatPercent: (value: number) => string;
    getStatusBadge: (completed: number, late: number, total: number) => React.ReactNode;
    getProgressBarClass: (late: number, completed: number, total: number) => string;
}

function ProgramCard({ group, isExpandedByDefault, formatPercent, getStatusBadge, getProgressBarClass }: ProgramCardProps) {
    const [isExpanded, setIsExpanded] = useState(isExpandedByDefault);

    const toggleExpanded = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <div className="card n1-card">
            {/* Header */}
            <div className="n1-card-hdr" onClick={toggleExpanded}>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                        {group.n1}
                    </div>
                    {group.n0 && group.n0 !== group.n1 && (
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            {group.n0}
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {getStatusBadge(group.completed, group.late, group.activities.length)}
                    <span className="act-group-chevron">{isExpanded ? '▾' : '▸'}</span>
                </div>
            </div>

            {/* Progress Bar */}
            <div style={{ padding: '0 14px 10px' }}>
                <div className="flex-between mb-8">
                    <span className="fs-sm text-muted">{group.activities.length} actividades</span>
                    <span className="fs-sm fw-bold">{formatPercent(group.execution)}</span>
                </div>
                <div className="progress-wrap">
                    <div
                        className={getProgressBarClass(group.late, group.completed, group.activities.length)}
                        style={{ width: `${Math.min(100, group.execution).toFixed(1)}%` }}
                    ></div>
                </div>
            </div>

            {/* Expandable Body */}
            <div className={`n1-card-body ${!isExpanded ? 'collapsed' : ''}`}>
                {group.n2Groups.map((n2Group) => (
                    <div key={n2Group.n2} className="n2-row">
                        <div className="n2-label">{n2Group.n2}</div>
                        <div className="n2-meta">
                            <span className="fs-sm text-muted">{n2Group.activities.length} act.</span>
                            {getStatusBadge(n2Group.completed, n2Group.late, n2Group.activities.length)}
                            <span className="fs-sm fw-bold">{formatPercent(n2Group.execution)}</span>
                        </div>
                        <div className="progress-wrap">
                            <div
                                className={getProgressBarClass(n2Group.late, n2Group.completed, n2Group.activities.length)}
                                style={{ width: `${Math.min(100, n2Group.execution).toFixed(1)}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

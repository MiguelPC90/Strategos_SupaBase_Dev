import React, { useMemo, useState } from 'react';
import { useFilters } from '../context/FilterContext';
import { useActivities } from '../hooks/useSupabase';
import type { Activity } from '../types';

export default function Gantt() {
    const { n0, n1 } = useFilters();
    const { data: activities, loading, error } = useActivities({ n0, n1 });
    const [scale, setScale] = useState<'month' | 'quarter'>('month');
    const [level, setLevel] = useState<1 | 2 | 3 | 4>(2);

    // Calculate timeline bounds
    const timelineBounds = useMemo(() => {
        if (!activities || activities.length === 0) return null;

        const dates = activities
            .filter(a => a.rs && a.rf)
            .flatMap(a => [new Date(a.rs!), new Date(a.rf!)]);

        if (dates.length === 0) return null;

        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

        // Extend bounds by 1 month on each side
        minDate.setMonth(minDate.getMonth() - 1);
        maxDate.setMonth(maxDate.getMonth() + 1);

        return { minDate, maxDate };
    }, [activities]);

    // Group activities by hierarchy level
    const groupedActivities = useMemo(() => {
        if (!activities) return [];

        const groups = new Map<string, Activity[]>();

        activities.forEach(activity => {
            let key: string;
            switch (level) {
                case 1:
                    key = activity.n0 || activity.n1 || '—';
                    break;
                case 2:
                    key = activity.n1 || '—';
                    break;
                case 3:
                    key = activity.n2 || '—';
                    break;
                case 4:
                    key = activity.n3 || activity.nome || '—';
                    break;
                default:
                    key = activity.n1 || '—';
            }

            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(activity);
        });

        return Array.from(groups.entries())
            .sort(([a], [b]) => a.localeCompare(b, 'pt', { numeric: true }))
            .map(([key, items]) => ({
                key,
                activities: items.sort((a, b) => {
                    const aStart = a.start ? new Date(a.start).getTime() : 0;
                    const bStart = b.start ? new Date(b.start).getTime() : 0;
                    return aStart - bStart;
                })
            }));
    }, [activities, level]);

    // Generate timeline headers
    const timelineHeaders = useMemo(() => {
        if (!timelineBounds) return [];

        const { minDate, maxDate } = timelineBounds;
        const headers: { label: string; start: Date; end: Date }[] = [];

        if (scale === 'month') {
            const current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
            while (current <= maxDate) {
                const end = new Date(current.getFullYear(), current.getMonth() + 1, 0);
                headers.push({
                    label: current.toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' }),
                    start: new Date(current),
                    end: new Date(end)
                });
                current.setMonth(current.getMonth() + 1);
            }
        } else {
            const current = new Date(minDate.getFullYear(), Math.floor(minDate.getMonth() / 3) * 3, 1);
            while (current <= maxDate) {
                const end = new Date(current.getFullYear(), current.getMonth() + 3, 0);
                headers.push({
                    label: `Q${Math.floor(current.getMonth() / 3) + 1}/${current.getFullYear().toString().slice(-2)}`,
                    start: new Date(current),
                    end: new Date(end)
                });
                current.setMonth(current.getMonth() + 3);
            }
        }

        return headers;
    }, [timelineBounds, scale]);

    // Calculate position and width for an activity bar
    const getActivityStyle = (activity: Activity) => {
        if (!timelineBounds || !activity.start || !activity.finish) {
            return { display: 'none' };
        }

        const { minDate, maxDate } = timelineBounds;
        const totalDuration = maxDate.getTime() - minDate.getTime();
        const activityStart = new Date(activity.start).getTime();
        const activityEnd = new Date(activity.finish).getTime();

        const left = ((activityStart - minDate.getTime()) / totalDuration) * 100;
        const width = ((activityEnd - activityStart) / totalDuration) * 100;

        return {
            left: `${Math.max(0, left)}%`,
            width: `${Math.max(1, width)}%`,
            backgroundColor: getStatusColor(activity.status)
        };
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Concluído': return '#95BB42';
            case 'Em dia': return '#002E5E';
            case 'Em atraso': return '#D94F3D';
            default: return '#666';
        }
    };

    const getStatusBadge = (status: string) => {
        const colors = {
            'Concluído': 'badge-done',
            'Em dia': 'badge-ok',
            'Em atraso': 'badge-late'
        };
        return colors[status as keyof typeof colors] || '';
    };

    if (loading) {
        return (
            <section className="card">
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Carregando gantt...</p>
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

    if (!activities || activities.length === 0) {
        return (
            <section className="card">
                <div className="empty-state">
                    <div className="empty-state-icon">📅</div>
                    <p>Sem actividades para mostrar no gantt.</p>
                </div>
            </section>
        );
    }

    return (
        <section className="card">
            <h1>Gantt</h1>

            {/* Toolbar */}
            <div className="gantt-toolbar" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                padding: '12px 0',
                borderBottom: '1px solid var(--border)'
            }}>
                <div className="gantt-legend" style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                        <div style={{ width: '16px', height: '4px', background: 'rgba(0,46,94,.35)' }}></div>
                        Baseline
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                        <div style={{ width: '16px', height: '4px', background: 'var(--navy)' }}></div>
                        Real
                    </span>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text2)' }}>Escala:</span>
                    <button
                        className={`chip ${scale === 'month' ? 'active' : ''}`}
                        onClick={() => setScale('month')}
                    >
                        Mês
                    </button>
                    <button
                        className={`chip ${scale === 'quarter' ? 'active' : ''}`}
                        onClick={() => setScale('quarter')}
                    >
                        Trimestre
                    </button>

                    <div style={{ width: '1px', height: '16px', background: 'var(--border2)', margin: '0 8px' }}></div>

                    <span style={{ fontSize: '11px', color: 'var(--text2)' }}>Nível:</span>
                    {[1, 2, 3, 4].map(lvl => (
                        <button
                            key={lvl}
                            className={`chip ${level === lvl ? 'active' : ''}`}
                            onClick={() => setLevel(lvl as 1 | 2 | 3 | 4)}
                        >
                            N{lvl}
                        </button>
                    ))}
                </div>
            </div>

            {/* Gantt Chart */}
            <div className="card" style={{ padding: 0, overflow: 'auto', maxHeight: '70vh' }}>
                <div style={{ minWidth: '800px' }}>
                    {/* Timeline Header */}
                    <div style={{
                        display: 'flex',
                        borderBottom: '1px solid var(--border)',
                        background: 'var(--bg2)',
                        position: 'sticky',
                        top: 0,
                        zIndex: 10
                    }}>
                        <div style={{
                            width: '250px',
                            padding: '8px 12px',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            borderRight: '1px solid var(--border)',
                            background: 'var(--bg)',
                            position: 'sticky',
                            left: 0,
                            zIndex: 20
                        }}>
                            Actividade
                        </div>
                        <div style={{ display: 'flex', flex: 1 }}>
                            {timelineHeaders.map((header, index) => (
                                <div
                                    key={index}
                                    style={{
                                        flex: 1,
                                        padding: '8px 4px',
                                        textAlign: 'center',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        color: 'var(--text2)',
                                        borderRight: index < timelineHeaders.length - 1 ? '1px solid var(--border)' : 'none'
                                    }}
                                >
                                    {header.label}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Activity Rows */}
                    {groupedActivities.map((group, groupIndex) => (
                        <div key={group.key} style={{
                            display: 'flex',
                            borderBottom: '1px solid var(--border)',
                            background: groupIndex % 2 === 0 ? 'var(--bg)' : 'var(--bg2)'
                        }}>
                            <div style={{
                                width: '250px',
                                padding: '12px',
                                fontSize: '12px',
                                borderRight: '1px solid var(--border)',
                                background: 'var(--bg)',
                                position: 'sticky',
                                left: 0,
                                zIndex: 15
                            }}>
                                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                                    {group.key}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text2)' }}>
                                    {group.activities.length} actividade{group.activities.length !== 1 ? 's' : ''}
                                </div>
                            </div>

                            <div style={{
                                flex: 1,
                                position: 'relative',
                                height: '50px',
                                display: 'flex'
                            }}>
                                {/* Timeline grid lines */}
                                {timelineHeaders.map((_, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            position: 'absolute',
                                            left: `${(index / timelineHeaders.length) * 100}%`,
                                            top: 0,
                                            bottom: 0,
                                            width: '1px',
                                            background: 'var(--border)',
                                            zIndex: 1
                                        }}
                                    />
                                ))}

                                {/* Activity bars */}
                                {group.activities.map((activity, activityIndex) => (
                                    <div
                                        key={activityIndex}
                                        style={{
                                            position: 'absolute',
                                            top: `${activityIndex * 8 + 8}px`,
                                            height: '6px',
                                            borderRadius: '3px',
                                            ...getActivityStyle(activity),
                                            zIndex: 5
                                        }}
                                        title={`${activity.name} (${activity.status})`}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Activity Details Table */}
            <div className="card" style={{ marginTop: '1rem' }}>
                <div className="card-title" style={{ marginBottom: '1rem' }}>
                    Detalhes das Actividades
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{
                                    padding: '8px 12px',
                                    textAlign: 'left',
                                    borderBottom: '1px solid var(--border)',
                                    fontSize: '11px',
                                    color: 'var(--text2)',
                                    fontWeight: 500
                                }}>
                                    Actividade
                                </th>
                                <th style={{
                                    padding: '8px 12px',
                                    textAlign: 'left',
                                    borderBottom: '1px solid var(--border)',
                                    fontSize: '11px',
                                    color: 'var(--text2)',
                                    fontWeight: 500
                                }}>
                                    Estado
                                </th>
                                <th style={{
                                    padding: '8px 12px',
                                    textAlign: 'left',
                                    borderBottom: '1px solid var(--border)',
                                    fontSize: '11px',
                                    color: 'var(--text2)',
                                    fontWeight: 500
                                }}>
                                    Início
                                </th>
                                <th style={{
                                    padding: '8px 12px',
                                    textAlign: 'left',
                                    borderBottom: '1px solid var(--border)',
                                    fontSize: '11px',
                                    color: 'var(--text2)',
                                    fontWeight: 500
                                }}>
                                    Fim
                                </th>
                                <th style={{
                                    padding: '8px 12px',
                                    textAlign: 'right',
                                    borderBottom: '1px solid var(--border)',
                                    fontSize: '11px',
                                    color: 'var(--text2)',
                                    fontWeight: 500
                                }}>
                                    Progresso
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {activities.slice(0, 20).map((activity, index) => (
                                <tr key={index} style={{
                                    borderBottom: '1px solid var(--border)',
                                    background: index % 2 === 0 ? 'var(--bg)' : 'var(--bg2)'
                                }}>
                                    <td style={{ padding: '8px 12px', fontSize: '12px' }}>
                                        {activity.name}
                                    </td>
                                    <td style={{ padding: '8px 12px' }}>
                                        <span className={`badge ${getStatusBadge(activity.status)}`}>
                                            {activity.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text2)' }}>
                                        {activity.start ? new Date(activity.start).toLocaleDateString('pt-PT') : '—'}
                                    </td>
                                    <td style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text2)' }}>
                                        {activity.finish ? new Date(activity.finish).toLocaleDateString('pt-PT') : '—'}
                                    </td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px' }}>
                                        {activity.pct ? `${activity.pct.toFixed(1)}%` : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}

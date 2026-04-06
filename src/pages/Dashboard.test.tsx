import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Dashboard from './Dashboard';
import { FilterProvider } from '../context/FilterContext';
import * as useSupabase from '../hooks/useSupabase';

// Mock the hooks
jest.mock('../hooks/useSupabase');
jest.mock('../context/FilterContext', () => ({
    ...jest.requireActual('../context/FilterContext'),
    useFilters: () => ({ n0: null, n1: null }),
}));

const mockUseActivities = useSupabase.useActivities as jest.MockedFunction<typeof useSupabase.useActivities>;

describe('Dashboard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('shows loading state initially', () => {
        mockUseActivities.mockReturnValue({
            data: null,
            loading: true,
            error: null,
        });

        render(
            <FilterProvider>
                <Dashboard />
            </FilterProvider>
        );

        expect(screen.getByText('Carregando dashboard...')).toBeInTheDocument();
    });

    it('shows error state when there is an error', () => {
        const errorMessage = 'Failed to fetch data';
        mockUseActivities.mockReturnValue({
            data: null,
            loading: false,
            error: new Error(errorMessage),
        });

        render(
            <FilterProvider>
                <Dashboard />
            </FilterProvider>
        );

        expect(screen.getByText(`Erro ao carregar dados: ${errorMessage}`)).toBeInTheDocument();
    });

    it('shows empty state when no activities', () => {
        mockUseActivities.mockReturnValue({
            data: [],
            loading: false,
            error: null,
        });

        render(
            <FilterProvider>
                <Dashboard />
            </FilterProvider>
        );

        expect(screen.getByText('Sem actividades para mostrar')).toBeInTheDocument();
    });

    it('renders dashboard with activities data', async () => {
        const mockActivities = [
            {
                nivel: 2,
                nome: 'Activity 1',
                n0: 'Programa A',
                n1: 'Iniciativa 1',
                n2: 'Projeto 1',
                n3: 'Actividade 1',
                id0: 'prog-a',
                id1: 'init-1',
                id2: 'proj-1',
                bs: '2024-01-01',
                bf: '2024-12-31',
                rs: '2024-01-01',
                rf: null,
                pct: 100,
                pct_prev: 90,
                status: 'Concluído',
                sponsor: 'Sponsor A',
                owner: 'Owner A',
                finish: '2024-12-31',
                notes: 'Some notes',
                source: 'gantt' as const,
                _supabase_id: '1',
            },
            {
                nivel: 2,
                nome: 'Activity 2',
                n0: 'Programa A',
                n1: 'Iniciativa 1',
                n2: 'Projeto 2',
                n3: 'Actividade 2',
                id0: 'prog-a',
                id1: 'init-1',
                id2: 'proj-2',
                bs: '2024-01-01',
                bf: '2024-12-31',
                rs: '2024-01-01',
                rf: null,
                pct: 75,
                pct_prev: 80,
                status: 'Em dia',
                sponsor: 'Sponsor A',
                owner: 'Owner B',
                finish: '2024-12-31',
                notes: null,
                source: 'gantt' as const,
                _supabase_id: '2',
            },
            {
                nivel: 2,
                nome: 'Activity 3',
                n0: 'Programa B',
                n1: 'Iniciativa 2',
                n2: 'Projeto 3',
                n3: 'Actividade 3',
                id0: 'prog-b',
                id1: 'init-2',
                id2: 'proj-3',
                bs: '2024-01-01',
                bf: '2024-12-31',
                rs: '2024-01-01',
                rf: null,
                pct: 50,
                pct_prev: 70,
                status: 'Em atraso',
                sponsor: 'Sponsor B',
                owner: 'Owner C',
                finish: '2024-12-31',
                notes: null,
                source: 'gantt' as const,
                _supabase_id: '3',
            },
        ];

        mockUseActivities.mockReturnValue({
            data: mockActivities,
            loading: false,
            error: null,
        });

        render(
            <FilterProvider>
                <Dashboard />
            </FilterProvider>
        );

        // Check if main elements are rendered
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Filtro atual: Todos N0 / Todos N1')).toBeInTheDocument();

        // Check KPI cards
        expect(screen.getByText('Execução')).toBeInTheDocument();
        expect(screen.getByText('Concluídas')).toBeInTheDocument();
        expect(screen.getByText('Em dia')).toBeInTheDocument();
        expect(screen.getByText('Em atraso')).toBeInTheDocument();

        // Check concretization section
        expect(screen.getByText('Concretização')).toBeInTheDocument();
        expect(screen.getByText('Grau de execução')).toBeInTheDocument();
        expect(screen.getByText('Concretização geral')).toBeInTheDocument();
        expect(screen.getByText('Concretização à data')).toBeInTheDocument();

        // Check programs section
        expect(screen.getByText('Por programa / eixo')).toBeInTheDocument();

        // Check program names appear
        await waitFor(() => {
            expect(screen.getByText('Iniciativa 1')).toBeInTheDocument();
            expect(screen.getByText('Iniciativa 2')).toBeInTheDocument();
        });
    });

    it('calculates KPIs correctly', async () => {
        const mockActivities = [
            {
                nivel: 2,
                nome: 'Activity 1',
                n0: 'Programa A',
                n1: 'Iniciativa 1',
                n2: 'Projeto 1',
                n3: 'Actividade 1',
                id0: 'prog-a',
                id1: 'init-1',
                id2: 'proj-1',
                bs: '2024-01-01',
                bf: '2024-12-31',
                rs: '2024-01-01',
                rf: null,
                pct: 100,
                pct_prev: 90,
                status: 'Concluído',
                sponsor: 'Sponsor A',
                owner: 'Owner A',
                finish: '2024-12-31',
                notes: 'Some notes',
                source: 'gantt' as const,
                _supabase_id: '1',
            },
            {
                nivel: 2,
                nome: 'Activity 2',
                n0: 'Programa A',
                n1: 'Iniciativa 1',
                n2: 'Projeto 2',
                n3: 'Actividade 2',
                id0: 'prog-a',
                id1: 'init-1',
                id2: 'proj-2',
                bs: '2024-01-01',
                bf: '2024-12-31',
                rs: '2024-01-01',
                rf: null,
                pct: 75,
                pct_prev: 80,
                status: 'Em dia',
                sponsor: 'Sponsor A',
                owner: 'Owner B',
                finish: '2024-12-31',
                notes: null,
                source: 'gantt' as const,
                _supabase_id: '2',
            },
        ];

        mockUseActivities.mockReturnValue({
            data: mockActivities,
            loading: false,
            error: null,
        });

        render(
            <FilterProvider>
                <Dashboard />
            </FilterProvider>
        );

        // Wait for calculations to complete
        await waitFor(() => {
            // Execution: (100 + 75) / 2 = 87.5%
            expect(screen.getByText('87.5%')).toBeInTheDocument();
            // Completed: 1
            expect(screen.getByText('1')).toBeInTheDocument();
            // On time: 1
            // Late: 0
        });
    });
});
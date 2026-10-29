
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import { api } from '../api';

vi.mock('../api', () => ({
  api: vi.fn(),
  clearToken: vi.fn(),
  getToken: vi.fn(),
  setToken: vi.fn(),
}));

const summary = {
  total: 150,
  count: 1,
  by_category: [{ category: 'Groceries', total: 150 }],
};

function serve({ items }) {
  api.mockImplementation(async (path, options = {}) => {
    if (path.startsWith('/me/summary')) return summary;
    if (options.method === 'DELETE') return null;
    if (path.startsWith('/me/expenses/')) return { items, total: items.length, limit: 10, offset: 0 };
    throw new Error(`unexpected call: ${path}`);
  });
}

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loaded expenses and the total count', async () => {
    serve({
      items: [
        {
          id: 1, amount: 150, category: 'Groceries',
          description: 'Weekly shop', is_anomaly: false,
          timestamp: '2026-10-28T10:00:00Z', owner_id: 1,
        },
      ],
    });
    renderDashboard();

    expect(await screen.findByText('Weekly shop')).toBeInTheDocument();
    expect(screen.getByText(/1 total/)).toBeInTheDocument();
  });

  it('shows an empty state when there are no expenses', async () => {
    serve({ items: [] });
    renderDashboard();

    expect(await screen.findByText(/No expenses yet/i)).toBeInTheDocument();
  });

  it('flags anomalous expenses', async () => {
    serve({
      items: [
        {
          id: 2, amount: 90000, category: 'Rent',
          description: 'Huge bill', is_anomaly: true,
          timestamp: '2026-10-28T10:00:00Z', owner_id: 1,
        },
      ],
    });
    renderDashboard();

    expect(await screen.findByText('ML FLAGGED')).toBeInTheDocument();
  });

  it('deletes an expense after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    serve({
      items: [
        {
          id: 7, amount: 50, category: 'Transport',
          description: 'Cab', is_anomaly: false,
          timestamp: '2026-10-28T10:00:00Z', owner_id: 1,
        },
      ],
    });
    const user = userEvent.setup();
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: /delete cab/i }));

    expect(api).toHaveBeenCalledWith('/me/expenses/7', { method: 'DELETE' });
  });
});
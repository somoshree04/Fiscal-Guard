
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Login from './Login';
import { api, setToken } from '../api';

vi.mock('../api', () => ({
  api: vi.fn(),
  setToken: vi.fn(),
  getToken: vi.fn(),
  clearToken: vi.fn(),
}));

const renderLogin = () =>
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<p>Dashboard page</p>} />
      </Routes>
    </MemoryRouter>
  );

async function fillAndSubmit(user) {
  await user.type(screen.getByLabelText(/email/i), 'a@example.com');
  await user.type(screen.getByLabelText(/password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /sign in/i }));
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs in, stores the token and goes to the dashboard', async () => {
    api.mockResolvedValue({ access_token: 'abc' });
    const user = userEvent.setup();
    renderLogin();

    await fillAndSubmit(user);

    expect(api).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: { email: 'a@example.com', password: 'password123' },
      auth: false,
    });
    expect(setToken).toHaveBeenCalledWith('abc');
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
  });

  it('shows the server error and stays on the page when login fails', async () => {
    api.mockRejectedValue(new Error('Incorrect email or password'));
    const user = userEvent.setup();
    renderLogin();

    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password');
    expect(setToken).not.toHaveBeenCalled();
    expect(screen.queryByText('Dashboard page')).not.toBeInTheDocument();
  });
});
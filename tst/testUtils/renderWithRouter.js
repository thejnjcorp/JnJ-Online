import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Most page components use react-router-dom hooks/components (Link,
// useNavigate, useLocation) that throw outside a Router context. Wraps RTL's
// render with a MemoryRouter so those work without a real browser history.
export function renderWithRouter(ui, { route = '/', ...renderOptions } = {}) {
    return render(ui, {
        wrapper: ({ children }) => <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>,
        ...renderOptions,
    });
}

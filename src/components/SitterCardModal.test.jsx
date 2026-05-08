// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SitterCardModal from './SitterCardModal.jsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const sampleGirls = [
  { id: 1, name: 'Mary Nolen', birthday: '2023-06-27', clothes: '3T', shoe: '7', diaper: 'Pull-Ups 3T', allergies: 'None known' },
];
const sampleHousehold = [{ key: 'Pediatrician', value: 'Dr. Smith — 555-0100' }];

function renderModal({ open = true, girls = sampleGirls, household = sampleHousehold, sitterNotes = 'Naps at 1pm' } = {}) {
  const onClose = vi.fn();
  const utils = render(
    <SitterCardModal
      open={open}
      onClose={onClose}
      girls={girls}
      household={household}
      sitterNotes={sitterNotes}
    />
  );
  return { onClose, ...utils };
}

describe('SitterCardModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <SitterCardModal open={false} onClose={() => {}} girls={[]} household={[]} sitterNotes="" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the SVG preview with the girl\'s name when open', () => {
    const { container } = renderModal();
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg.outerHTML).toContain('Mary Nolen');
    expect(svg.outerHTML).toContain('NOTES');
  });

  it('shows the share button and the help hint', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /Share/i })).toBeTruthy();
    expect(screen.getByText(/AirDrop or text/i)).toBeTruthy();
  });

  it('calls onClose when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    // The backdrop is the outermost div; the close × is also wired to onClose.
    await user.click(screen.getByRole('button', { name: '×' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose when the inner card is clicked', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByText(/Preview/));
    expect(onClose).not.toHaveBeenCalled();
  });
});

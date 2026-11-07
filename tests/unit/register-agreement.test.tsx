/**
 * Registration Legal & Security Agreement stage (spec B):
 *  - the wizard step is backed by registerAgreementStep (all five checks);
 *  - the ConsentChecklist UI keeps its submit disabled until all five
 *    checkboxes are ticked and links every referenced policy document.
 */
jest.mock('@/features/legal/acceptance-actions', () => ({
  acceptLegalAgreementAction: jest.fn(async () => ({ ok: true })),
}));

import { fireEvent, render, screen } from '@testing-library/react';
import { ConsentChecklist } from '@/components/legal/consent-checklist';
import { LegalWarningBanner } from '@/components/legal/legal-warning-banner';
import { REGISTRATION_CHECKS, LEGAL_WARNING_AR } from '@/constants/legal';
import { registerAgreementStep } from '@/features/legal/schemas';

const ALL_TRUE = { terms: true, age: true, privacy: true, authorized: true, scope: true };

describe('registration agreement schema', () => {
  test('step cannot validate with any check missing', () => {
    expect(registerAgreementStep.safeParse(ALL_TRUE).success).toBe(true);
    for (const key of Object.keys(ALL_TRUE)) {
      expect(registerAgreementStep.safeParse({ ...ALL_TRUE, [key]: false }).success).toBe(false);
    }
  });
});

describe('ConsentChecklist (registration mode)', () => {
  test('renders exactly the five mandatory checks', () => {
    render(<ConsentChecklist mode="registration" />);
    for (const c of REGISTRATION_CHECKS) {
      expect(screen.getByLabelText(c.label)).toBeTruthy();
    }
  });

  test('submit button stays disabled until ALL five checkboxes are ticked', () => {
    render(<ConsentChecklist mode="registration" />);
    const submit = screen.getByRole('button', { name: /أوافق وأكمل التسجيل/ }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    const boxes = REGISTRATION_CHECKS.map((c) => screen.getByLabelText(c.label) as HTMLInputElement);
    // tick four of five — still locked
    for (const box of boxes.slice(0, 4)) fireEvent.click(box);
    expect(submit.disabled).toBe(true);
    // the fifth unlocks the stage
    fireEvent.click(boxes[4]);
    expect(submit.disabled).toBe(false);
  });

  test('every check with a policy link points at /legal/<slug>', () => {
    render(<ConsentChecklist mode="registration" />);
    const expectedSlugs = REGISTRATION_CHECKS.filter((c) => c.linkSlug).map((c) => c.linkSlug as string);
    const links = screen.getAllByRole('link', { name: /قراءة الوثيقة/ }) as HTMLAnchorElement[];
    expect(links).toHaveLength(expectedSlugs.length);
    for (const [i, link] of links.entries()) {
      expect(link.href).toContain(`/legal/${expectedSlugs[i]}`);
      expect(link.target).toBe('_blank');
    }
  });

  test('the assistant cannot bypass the stage by submitting an empty form', () => {
    render(<ConsentChecklist mode="registration" />);
    const submit = screen.getByRole('button', { name: /أوافق وأكمل التسجيل/ }) as HTMLButtonElement;
    expect(submit.getAttribute('aria-disabled')).toBe('true');
  });
});

describe('legal warning banner', () => {
  test('states clearly that the docs are not lawyer-reviewed in Egypt', () => {
    render(<LegalWarningBanner />);
    expect(screen.getByRole('note').textContent).toContain(LEGAL_WARNING_AR);
    expect(screen.getByRole('note').textContent).toContain('محامٍ مرخّص في مصر');
  });
});

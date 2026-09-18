import { component, signal } from 'sigx';
import { Alert, Badge, Card, Divider } from '@sigx/zero';
import type { PartProps } from '@sigx/zero';
import { DemoRow } from '../demo/Section';
import { pickRole, pickScopeVariant } from '../design-systems';
import type { PageEntry } from './registry';

// ── Card ──────────────────────────────────────────────────────────────────

const CardDemos = component(() => () => (
    <>
        <p>
            A surface with a conventional interior and no behavior: no state,
            no context, no ids. <code>Card.Title</code> renders an{' '}
            <code>&lt;h3&gt;</code> so a page of cards is navigable from a
            heading list; everything below <code>root</code> is optional.
        </p>
        <DemoRow gap="1rem" align="stretch">
            <Card.Root color={pickRole('primary')}>
                <Card.Header>
                    <Card.Title>Monthly report</Card.Title>
                    <Card.Description>Updated 4 minutes ago</Card.Description>
                </Card.Header>
                <Card.Body>
                    Every design system decides whether a card is elevated,
                    outlined or tonal — zero only says where the bands are.
                </Card.Body>
                <Card.Footer>
                    <Badge color={pickRole('success')}>Ready</Badge>
                </Card.Footer>
            </Card.Root>
            <Card.Root>
                <Card.Body>Just a body — the smallest card there is.</Card.Body>
            </Card.Root>
        </DemoRow>
    </>
), { name: 'CardDemos' });

export const cardPage: PageEntry = {
    id: 'card',
    title: 'Card',
    category: 'Display & feedback',
    Demos: CardDemos,
};

// ── Alert ─────────────────────────────────────────────────────────────────

const AlertDemos = component(() => {
    const state = signal({ quota: true });

    return () => (
        <>
            <p>
                <code>role="alert"</code> is the line between this and Card: a
                live region announces <em>changes</em>, so a server-rendered
                alert is silent at load and one inserted later is announced —
                the right behaviour in both cases from one declaration. The
                model is the alert's presence and defaults to open;{' '}
                <code>Alert.Close</code> sets it false and the runtime sets{' '}
                <code>hidden</code>, which is what the anatomy's{' '}
                <code>hiddenIn: ['closed']</code> declares.
            </p>
            <DemoRow gap="1rem" align="stretch">
                <Alert.Root model={() => state.quota} color={pickRole('warning')}>
                    <Alert.Icon>⚠</Alert.Icon>
                    <Alert.Title>Approaching your quota</Alert.Title>
                    <Alert.Description>
                        You have used 92% of this month's allowance.
                    </Alert.Description>
                    <Alert.Close label="Dismiss quota warning">×</Alert.Close>
                </Alert.Root>
            </DemoRow>
            <p>
                <small>
                    Quota alert open: <code>{String(state.quota)}</code>{' '}
                    <button type="button" onClick={() => { state.quota = true; }}>
                        Bring it back
                    </button>
                </small>
            </p>
            <DemoRow gap="1rem" align="stretch">
                <Alert.Root color={pickRole('error', 'danger')}>
                    <Alert.Icon>✕</Alert.Icon>
                    <Alert.Title>Payment failed</Alert.Title>
                    <Alert.Description>The card was declined.</Alert.Description>
                </Alert.Root>
                <Alert.Root color={pickRole('success')}>
                    <Alert.Icon>✓</Alert.Icon>
                    <Alert.Title>Deploy complete</Alert.Title>
                    <Alert.Description>Live in every region.</Alert.Description>
                    <Alert.Close>×</Alert.Close>
                </Alert.Root>
            </DemoRow>
        </>
    );
}, { name: 'AlertDemos' });

export const alertPage: PageEntry = {
    id: 'alert',
    title: 'Alert',
    category: 'Display & feedback',
    Demos: AlertDemos,
};

// ── Badge ─────────────────────────────────────────────────────────────────

const BadgeDemos = component(() => () => (
    <>
        <p>
            One element, and that is the point: at badge scale the fill{' '}
            <em>is</em> the component, so <code>root</code> both carries the
            axes and renders the text. That shape is why badge is the content
            component that wires its own <code>variant</code> vocabulary —
            zero-basic narrows it to <code>solid | soft | outline</code> through{' '}
            <code>tokens.scopes</code>, because a ghost badge is a word with no
            box. Switch to another design system and the variant prop simply
            stops applying.
        </p>
        <DemoRow gap="0.5rem">
            <Badge color={pickRole('primary')}>Default</Badge>
            {/*
              * `pickScopeVariant`, not `pickVariant`: only zero-basic wires a
              * variant on badge. The other five DECLARE the same values
              * design-system-wide and wire none of them here, so asking the
              * union would set an attribute matching no badge rule (#297).
              */}
            <Badge color={pickRole('success')} variant={pickScopeVariant('badge', 'solid')}>Active</Badge>
            <Badge color={pickRole('warning')} variant={pickScopeVariant('badge', 'soft')}>Pending</Badge>
            <Badge color={pickRole('error', 'danger')} variant={pickScopeVariant('badge', 'outline')}>Failed</Badge>
        </DemoRow>
        <p>
            <code>asChild</code>, because a badge is so often already something
            else — a link to the filtered list, a button that removes the tag:
        </p>
        <DemoRow gap="0.5rem">
            <Badge color={pickRole('error', 'danger')} asChild>
                {(p: PartProps) => <a href="#/badge" {...p}>3 failed</a>}
            </Badge>
        </DemoRow>
    </>
), { name: 'BadgeDemos' });

export const badgePage: PageEntry = {
    id: 'badge',
    title: 'Badge',
    category: 'Display & feedback',
    Demos: BadgeDemos,
};

// ── Divider ───────────────────────────────────────────────────────────────

const DividerDemos = component(() => () => (
    <>
        <p>
            A separator with the role the platform already has for one.
            Non-focusable — the focusable flavour is for split-pane handles that
            can be moved, and this one cannot. <code>aria-orientation</code> is
            emitted only for <code>vertical</code>, since horizontal is the
            role's own default.
        </p>
        <div style="max-width: 28rem">
            <p>Above the rule.</p>
            <Divider />
            <p>Below it.</p>
        </div>
        <DemoRow gap="0.75rem" align="center">
            <span>left</span>
            <Divider orientation="vertical" />
            <span>middle</span>
            <Divider orientation="vertical" color={pickRole('primary')} />
            <span>right</span>
        </DemoRow>
    </>
), { name: 'DividerDemos' });

export const dividerPage: PageEntry = {
    id: 'divider',
    title: 'Divider',
    category: 'Display & feedback',
    Demos: DividerDemos,
};

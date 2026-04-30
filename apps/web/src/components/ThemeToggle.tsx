import clsx from 'clsx';
import { THEMES, useThemeStore } from '../lib/theme';

interface Props {
  /** 'compact' shows icons only; 'full' shows icon + label. */
  variant?: 'compact' | 'full';
  className?: string;
}

export default function ThemeToggle({ variant = 'compact', className }: Props) {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div
      role="radiogroup"
      aria-label="Тема оформления"
      className={clsx(
        'inline-flex items-center gap-1 p-1 rounded-lg border border-line bg-surface-subtle',
        className,
      )}
    >
      {THEMES.map((t) => {
        const active = theme === t.value;
        return (
          <button
            key={t.value}
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(t.value)}
            title={t.label}
            className={clsx(
              'rounded-md text-sm transition flex items-center gap-1.5',
              variant === 'compact' ? 'w-7 h-7 justify-center' : 'px-2.5 py-1',
              active
                ? 'bg-accent text-white shadow-card'
                : 'text-ink-tertiary hover:text-ink-primary hover:bg-surface-card',
            )}
          >
            <span aria-hidden>{t.icon}</span>
            {variant === 'full' && <span>{t.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

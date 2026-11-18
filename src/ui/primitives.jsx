import { useEffect, useId, useRef } from 'react';
import { audio } from '../game/audio';
import { CloseIcon } from './Icons';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: labelled, traps Tab focus, restores focus on close.
 * Escape is handled globally in App so it also works mid-game.
 */
export function Modal({ title, eyebrow, onClose, children, footer, size = 'md', initialFocusDelay = 0 }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement;
    const timer = setTimeout(() => {
      const first = ref.current?.querySelector('[data-autofocus]') || ref.current?.querySelector(FOCUSABLE);
      first?.focus({ preventScroll: true });
    }, initialFocusDelay);

    const trap = (e) => {
      if (e.key !== 'Tab' || !ref.current) return;
      const items = [...ref.current.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', trap);
      if (previous && previous.focus && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [initialFocusDelay]);

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={ref} className={`modal modal--${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="modal__header">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2 id={titleId} className="modal__title">
              {title}
            </h2>
          </div>
          {onClose && (
            <button type="button" className="icon-btn icon-btn--quiet" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          )}
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__footer">{footer}</footer>}
      </div>
    </div>
  );
}

/** Radio group with roving tabindex + arrow-key navigation (WAI-ARIA pattern). */
export function useRadioKeys(options, value, onChange) {
  return (e) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const group = e.currentTarget; // currentTarget is cleared after dispatch — keep a reference
    const i = options.indexOf(value);
    const next = options[(i + keys[e.key] + options.length) % options.length];
    onChange(next);
    requestAnimationFrame(() => group.querySelector(`[data-value="${next}"]`)?.focus());
  };
}

export function Segmented({ label, options, value, onChange, renderOption }) {
  const keys = options.map((o) => o.value);
  const onKeyDown = useRadioKeys(keys, value, (v) => {
    audio.synth('select');
    onChange(v);
  });
  return (
    <div className="segmented" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            data-value={o.value}
            className="segmented__item"
            onClick={() => {
              if (!active) audio.synth('select');
              onChange(o.value);
            }}
          >
            {renderOption ? renderOption(o, active) : o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ label, hint, checked, onChange }) {
  const id = useId();
  return (
    <div className="setting-row">
      <div className="setting-row__text">
        <span id={id} className="setting-row__label">
          {label}
        </span>
        {hint && <span className="setting-row__hint">{hint}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        className="switch"
        onClick={() => {
          audio.synth('click');
          onChange(!checked);
        }}
      >
        <span className="switch__thumb" />
      </button>
    </div>
  );
}

export function Slider({ label, value, onChange, disabled }) {
  const id = useId();
  const pct = Math.round(value * 100);
  return (
    <div className="setting-row">
      <label htmlFor={id} className="setting-row__label">
        {label}
      </label>
      <div className="slider">
        <input
          id={id}
          type="range"
          min="0"
          max="100"
          step="5"
          value={pct}
          disabled={disabled}
          style={{ '--fill': `${pct}%` }}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          onPointerUp={() => audio.synth('tick')}
          onKeyUp={() => audio.synth('tick')}
        />
        <output htmlFor={id} className="slider__value">
          {pct}
        </output>
      </div>
    </div>
  );
}

export const Kbd = ({ children }) => <kbd className="kbd">{children}</kbd>;

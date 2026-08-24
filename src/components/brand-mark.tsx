type BrandMarkProps = {
  compact?: boolean;
  inverse?: boolean;
};

export function BrandMark({ compact = false, inverse = false }: BrandMarkProps) {
  return (
    <span className={`brand-mark${inverse ? " brand-mark--inverse" : ""}`} aria-label="ContentDock">
      <svg aria-hidden="true" viewBox="0 0 36 24" className="brand-mark__symbol">
        <path d="M13 4H8a8 8 0 0 0 0 16h5V4Z" />
        <path d="M23 4h5a8 8 0 0 1 0 16h-5V4Z" />
        <path d="M13 4h10v16H13z" className="brand-mark__bridge" />
      </svg>
      {compact ? null : <span>ContentDock</span>}
    </span>
  );
}

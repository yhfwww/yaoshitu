import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { Logo } from "./Logo";

export function AuxiliaryPage({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <section className="aux-page" role="dialog" aria-modal="true" aria-label={title}>
      <header className="aux-page-header">
        <div className="aux-page-brand">
          <Logo size={30} />
          <div>
            <div className="aux-page-title">{title}</div>
            <div className="aux-page-description">{description}</div>
          </div>
        </div>
        <button className="btn btn-ghost" onClick={onClose} aria-label={`关闭${title}`}>
          <Icon name="close" size={16} />
          关闭
        </button>
      </header>
      {children}
    </section>
  );
}

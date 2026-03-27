import { Link } from "react-router-dom";

type ShortcutCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  to: string;
  ctaLabel: string;
  featured?: boolean;
};

export default function ShortcutCard({
  eyebrow,
  title,
  description,
  to,
  ctaLabel,
  featured = false,
}: ShortcutCardProps) {
  return (
    <article className={featured ? "shortcut-card shortcut-card--featured" : "shortcut-card"}>
      <div className="shortcut-card__eyebrow">{eyebrow}</div>
      <h2 className="shortcut-card__title">{title}</h2>
      <p className="shortcut-card__description">{description}</p>
      <Link className={featured ? "btn btn--primary" : "btn btn--secondary"} to={to}>
        {ctaLabel}
      </Link>
    </article>
  );
}


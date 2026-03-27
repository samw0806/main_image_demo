type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

export default function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="shell__header">
      <div>
        <h1 className="shell__title">{title}</h1>
        {description ? <p className="shell__description">{description}</p> : null}
      </div>
      {actions ? <div className="shell__actions">{actions}</div> : null}
    </header>
  );
}

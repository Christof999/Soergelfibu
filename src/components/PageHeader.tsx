interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between px-4 sm:px-8 py-4 sm:py-5 bg-dark-800 border-b border-dark-700">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-bold text-gray-100 break-words">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5 break-words">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto">
          {actions}
        </div>
      )}
    </div>
  );
}

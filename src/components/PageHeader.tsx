interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="page-header-padding flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-dark-800 border-b border-dark-700">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-bold text-gray-100 break-words">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 shrink-0 w-full sm:w-auto [&>button]:justify-center [&>a]:justify-center [&>button]:min-h-[2.5rem] [&>a]:min-h-[2.5rem] [&>button]:flex-1 sm:[&>button]:flex-none sm:[&>a]:flex-none sm:[&>button]:justify-start sm:[&>a]:justify-start">
          {actions}
        </div>
      )}
    </div>
  );
}

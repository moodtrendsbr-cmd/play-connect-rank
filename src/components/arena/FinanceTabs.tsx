import { NavLink } from "react-router-dom";

const tabs = [
  { label: "Resumo", to: "/arena/dashboard/financeiro", end: true },
  { label: "Transações", to: "/arena/dashboard/transacoes" },
  { label: "Planos", to: "/arena/dashboard/planos" },
  { label: "Assinaturas", to: "/arena/dashboard/assinaturas" },
  { label: "Cobranças", to: "/arena/dashboard/cobrancas" },
];

export function FinanceTabs() {
  return (
    <div className="flex gap-1 border-b border-border overflow-x-auto">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            `px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${
              isActive
                ? "border-primary text-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </div>
  );
}

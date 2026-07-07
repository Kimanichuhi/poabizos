import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Building2, ShieldCheck, Layers, Users, BarChart3, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PoaBiz OS — Operations platform for growing SMEs" },
      { name: "description", content: "Sales, inventory, HR, payroll, assets and more — one secure multi-tenant platform for your business." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <PoaBizLogo className="h-9 w-9" />
            PoaBiz OS
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/register"><Button size="sm">Get started</Button></Link>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-20 md:py-28 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground mb-6">
          <Sparkles className="h-3 w-3 text-primary" /> Multi-tenant SaaS for SMEs
        </div>
        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight max-w-3xl mx-auto">
          One platform to run your <span className="text-primary">whole business</span>.
        </h1>
        <p className="text-muted-foreground mt-5 max-w-xl mx-auto text-lg">
          Sales, expenses, inventory, HR, payroll, assets and tasks — securely isolated for every business, with feature plans that scale as you grow.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link to="/register"><Button size="lg">Register your business</Button></Link>
          <Link to="/auth"><Button size="lg" variant="outline">Sign in</Button></Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-20 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Building2, title: "Tenant isolation", desc: "Row-level security keeps every business's data private." },
          { icon: ShieldCheck, title: "Role-based access", desc: "Admin, manager, and staff roles per workspace." },
          { icon: Users, title: "Team management", desc: "Invite staff, assign roles, audit every action." },
          { icon: BarChart3, title: "Reports & insights", desc: "Track sales, expenses, stock and people in one view." },
        ].map((f, i) => (
          <div key={i} className="rounded-xl border bg-card p-5">
            <f.icon className="h-5 w-5 text-primary mb-3" />
            <div className="font-medium">{f.title}</div>
            <div className="text-sm text-muted-foreground mt-1">{f.desc}</div>
          </div>
        ))}
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <h2 className="text-2xl font-semibold text-center mb-8">Plans that grow with you</h2>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { name: "Starter", items: ["Sales","Expenses","Customers","Reports"] },
            { name: "Growth", items: ["+ Inventory","+ Debtors","+ Suppliers","+ Stock reports"] },
            { name: "Business", items: ["+ HR","+ Payroll","+ Assets","+ Tasks"] },
            { name: "Premium", items: ["+ M-Pesa","+ SMS / WhatsApp","+ AI assistant","+ Multi-branch"] },
          ].map(p => (
            <div key={p.name} className="rounded-xl border bg-card p-5">
              <div className="font-semibold">{p.name}</div>
              <ul className="mt-3 text-sm text-muted-foreground space-y-1">
                {p.items.map(i => <li key={i}>{i}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground space-y-1">
        <div>© {new Date().getFullYear()} PoaBiz OS · <Link to="/platform-setup" className="hover:underline">Platform setup</Link></div>
        <div>Created by Qeem Labs Ltd.</div>
      </footer>
    </div>
  );
}

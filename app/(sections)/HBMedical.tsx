import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Key, 
  DollarSign, 
  GraduationCap, 
  Rocket, 
  Users, 
  Headphones 
} from "lucide-react";

const benefits = [
  {
    title: "Protected Sales Area",
    desc: "Your market is yours. We enforce geographic exclusivity so you're never competing against another HB rep.",
    icon: Key,
    tag: "ZIP-LEVEL PROTECTION",
    popular: false,
  },
  {
    title: "Industry-Leading Commissions",
    desc: "Top-tier commission structure with performance bonuses, recurring revenue on reorders, and accelerator tiers.",
    icon: DollarSign,
    tag: "RECURRING + RESIDUAL",
    popular: true,
  },
  {
    title: "Full Sales Support & Training",
    desc: "Clinical selling tools, physician-facing decks, objection handling playbooks, and live support from our team.",
    icon: GraduationCap,
    tag: "ONBOARD IN 5 DAYS",
    popular: false,
  },
  {
    title: "First-Mover Advantage",
    desc: "Non-Hydrolyzed Collagen is still emerging. Get in early and own your market before competitors catch on.",
    icon: Rocket,
    tag: "CATEGORY CREATOR",
    popular: false,
  },
  {
    title: "Marketing & Co-Op Dollars",
    desc: "Branded materials, digital campaigns, and co-op marketing funds to help you generate leads and grow.",
    icon: Users,
    tag: "DONE-FOR-YOU ASSETS",
    popular: false,
  },
  {
    title: "Dedicated Rep Success Team",
    desc: "Your dedicated success manager is one call away to help close deals and troubleshoot challenges.",
    icon: Headphones,
    tag: "DIRECT LINE ACCESS",
    popular: false,
  },
];

export function HBMedical() {
  return (
   <section className="py-24 bg-linear-to-br from-[#0e2c3f]  to-[#1c6869] text-white">
      <div className="container mx-auto px-4">
        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/5 px-4 py-1">
            WHY SPEARHEAD MEDICAL
          </Badge>
          <h2 className="text-4xl md:text-5xl font-serif font-bold tracking-tight">
            Built for <span className="text-emerald-400 italic">Elite Reps</span>
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed">
            We don't just hand you a product — we hand you a business. Here's what you unlock when you partner with Spearhead Medical.
          </p>
        </div>

        {/* Grid Section */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {benefits.map((b, i) => (
            <div key={i} className="relative group">
              {b.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                  <Badge className="bg-emerald-500 hover:bg-emerald-500 text-[10px] font-bold px-3 py-0.5 rounded-full text-emerald-950 uppercase tracking-wider">
                    Most Popular
                  </Badge>
                </div>
              )}
              
              <Card className={`h-full border-white/10 bg-white/5 backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:border-emerald-500/50 ${b.popular ? 'ring-1 ring-emerald-500/40' : ''}`}>
                <CardContent className="p-8 flex flex-col h-full">
                  <div className="mb-6 h-12 w-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <b.icon className="h-6 w-6 text-emerald-400" />
                  </div>
                  
                  <h3 className="text-xl font-bold mb-3 text-slate-50">{b.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed mb-8 grow">
                    {b.desc}
                  </p>
                  
                  <div className="mt-auto">
                    <span className="text-[10px] font-black tracking-widest text-emerald-400/60 uppercase border border-emerald-500/20 px-3 py-1.5 rounded-md bg-emerald-500/5">
                      {b.tag}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
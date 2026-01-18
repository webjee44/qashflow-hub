import { Link } from 'react-router-dom';
import { SEOHead, generateBreadcrumbSchema } from '@/components/seo/SEOHead';
import logo from '@/assets/logo.png';
import { Shield, Database, Lock, Clock, Eye, Cookie, Globe, Mail, ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function Confidentialite() {
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Accueil', url: '/' },
    { name: 'Politique de confidentialité', url: '/confidentialite' },
  ]);

  const sections = [
    {
      icon: Database,
      title: "1. Données collectées",
      content: (
        <>
          <p className="text-muted-foreground mb-4">Nous collectons les données suivantes :</p>
          <ul className="space-y-2 text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
              <span><strong className="text-foreground">Données d'identification</strong> : nom, prénom, email, téléphone</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
              <span><strong className="text-foreground">Données bancaires</strong> : transactions, soldes (via Bridge API)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
              <span><strong className="text-foreground">Données d'usage</strong> : pages visitées, fonctionnalités utilisées</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
              <span><strong className="text-foreground">Données techniques</strong> : adresse IP, type de navigateur</span>
            </li>
          </ul>
        </>
      ),
    },
    {
      icon: Eye,
      title: "2. Finalités du traitement",
      content: (
        <>
          <p className="text-muted-foreground mb-4">Vos données sont utilisées pour :</p>
          <ul className="space-y-2 text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
              <span>Fournir nos services de gestion de trésorerie</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
              <span>Améliorer nos produits et services</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
              <span>Vous contacter pour le support client</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
              <span>Respecter nos obligations légales</span>
            </li>
          </ul>
        </>
      ),
    },
    {
      icon: Shield,
      title: "3. Base légale",
      content: (
        <>
          <p className="text-muted-foreground mb-4">Le traitement de vos données repose sur :</p>
          <ul className="space-y-2 text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
              <span>L'exécution du contrat de service</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
              <span>Votre consentement explicite</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
              <span>Notre intérêt légitime à améliorer nos services</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
              <span>Le respect de nos obligations légales</span>
            </li>
          </ul>
        </>
      ),
    },
    {
      icon: Clock,
      title: "4. Durée de conservation",
      content: (
        <p className="text-muted-foreground">
          Vos données sont conservées pendant la durée de votre abonnement, 
          puis <strong className="text-foreground">3 ans</strong> après la fin de la relation commerciale, 
          conformément à la réglementation applicable.
        </p>
      ),
    },
    {
      icon: Lock,
      title: "5. Sécurité des données",
      content: (
        <>
          <p className="text-muted-foreground mb-4">Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles :</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              "Chiffrement AES-256 des données au repos et en transit",
              "Authentification à deux facteurs",
              "Hébergement sécurisé avec des partenaires certifiés",
              "Audits de sécurité réguliers",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                <Shield className="h-4 w-4 text-primary shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </>
      ),
    },
    {
      icon: Eye,
      title: "6. Vos droits",
      content: (
        <>
          <p className="text-muted-foreground mb-4">Conformément au RGPD, vous disposez des droits suivants :</p>
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            {[
              { title: "Droit d'accès", desc: "obtenir une copie de vos données" },
              { title: "Droit de rectification", desc: "corriger vos données" },
              { title: "Droit à l'effacement", desc: "supprimer vos données" },
              { title: "Droit à la portabilité", desc: "recevoir vos données dans un format structuré" },
              { title: "Droit d'opposition", desc: "vous opposer au traitement" },
              { title: "Droit de limitation", desc: "limiter le traitement de vos données" },
            ].map((item, i) => (
              <div key={i} className="text-sm bg-muted/50 rounded-lg p-3">
                <span className="font-medium text-foreground">{item.title}</span>
                <span className="text-muted-foreground"> : {item.desc}</span>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground">
            Pour exercer ces droits : <a href="mailto:contact@qashflow.fr" className="text-primary hover:underline font-medium">contact@qashflow.fr</a>
          </p>
        </>
      ),
    },
    {
      icon: Cookie,
      title: "7. Cookies",
      content: (
        <p className="text-muted-foreground">
          Nous utilisons des cookies essentiels au fonctionnement du service 
          et des cookies analytiques pour améliorer votre expérience. 
          Vous pouvez gérer vos préférences à tout moment dans les paramètres de votre navigateur.
        </p>
      ),
    },
    {
      icon: Globe,
      title: "8. Transferts de données",
      content: (
        <p className="text-muted-foreground">
          Vos données sont hébergées en Europe. En cas de transfert hors UE, 
          nous veillons à ce que des garanties appropriées soient en place 
          (clauses contractuelles types, décision d'adéquation).
        </p>
      ),
    },
    {
      icon: Mail,
      title: "9. Contact",
      content: (
        <div className="flex flex-col sm:flex-row gap-4">
          <Card className="flex-1 bg-muted/30 border-muted">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-foreground mb-1">Délégué à la Protection des Données</p>
              <a href="mailto:contact@qashflow.fr" className="text-primary hover:underline text-sm">
                contact@qashflow.fr
              </a>
            </CardContent>
          </Card>
          <Card className="flex-1 bg-muted/30 border-muted">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-foreground mb-1">Réclamation CNIL</p>
              <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
                www.cnil.fr
              </a>
            </CardContent>
          </Card>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Politique de confidentialité"
        description="Politique de confidentialité de qashflow - Comment nous collectons, utilisons et protégeons vos données personnelles."
        noIndex
      />
      
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center">
              <img src={logo} alt="Qashflow" className="h-9" />
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="max-w-4xl mx-auto text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Politique de confidentialité
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Chez Qashflow, nous prenons la protection de vos données personnelles très au sérieux. 
            Cette politique explique comment nous collectons, utilisons et protégeons vos informations.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Dernière mise à jour : Janvier 2026
          </p>
        </div>

        {/* Sections */}
        <div className="max-w-4xl mx-auto space-y-6">
          {sections.map((section, index) => (
            <Card key={index} className="overflow-hidden border-muted/50 hover:border-muted transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 shrink-0">
                    <section.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold mb-3">{section.title}</h2>
                    {section.content}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <footer className="py-8 px-4 border-t border-border">
        <div className="max-w-7xl mx-auto text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Retour à l'accueil
          </Link>
        </div>
      </footer>
    </div>
  );
}

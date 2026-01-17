import { Link } from 'react-router-dom';
import { SEOHead, generateBreadcrumbSchema } from '@/components/seo/SEOHead';
import logo from '@/assets/logo.png';

export default function MentionsLegales() {
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Accueil', url: '/' },
    { name: 'Mentions légales', url: '/mentions-legales' },
  ]);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Mentions légales"
        description="Mentions légales du site qashflow.fr - Informations sur l'éditeur, l'hébergement et les conditions d'utilisation."
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

      <main className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <article className="max-w-3xl mx-auto prose dark:prose-invert">
          <h1>Mentions légales</h1>
          
          <h2>1. Éditeur du site</h2>
          <p>
            Le site qashflow.fr est édité par :<br />
            <strong>qashflow SAS</strong><br />
            Société par Actions Simplifiée au capital de 10 000 €<br />
            Siège social : Paris, France<br />
            RCS Paris : [En cours d'immatriculation]<br />
            N° TVA intracommunautaire : [En cours]
          </p>
          
          <h2>2. Directeur de la publication</h2>
          <p>
            Le directeur de la publication est le représentant légal de la société qashflow SAS.
          </p>
          
          <h2>3. Hébergement</h2>
          <p>
            Le site est hébergé par :<br />
            <strong>Lovable / Supabase</strong><br />
            Hébergement cloud sécurisé
          </p>
          
          <h2>4. Propriété intellectuelle</h2>
          <p>
            L'ensemble des contenus (textes, images, vidéos, logos, etc.) présents sur le site 
            qashflow.fr sont la propriété exclusive de qashflow SAS ou de ses partenaires, 
            sauf mention contraire. Toute reproduction, même partielle, est strictement interdite 
            sans autorisation préalable.
          </p>
          
          <h2>5. Protection des données personnelles</h2>
          <p>
            Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi 
            Informatique et Libertés, vous disposez d'un droit d'accès, de rectification, 
            d'effacement et de portabilité de vos données personnelles.
          </p>
          <p>
            Pour exercer ces droits, contactez-nous à : <a href="mailto:dpo@qashflow.fr">dpo@qashflow.fr</a>
          </p>
          
          <h2>6. Cookies</h2>
          <p>
            Le site utilise des cookies pour améliorer l'expérience utilisateur et réaliser 
            des statistiques de visite. Vous pouvez configurer vos préférences de cookies 
            à tout moment.
          </p>
          
          <h2>7. Contact</h2>
          <p>
            Pour toute question concernant ces mentions légales :<br />
            Email : <a href="mailto:legal@qashflow.fr">legal@qashflow.fr</a>
          </p>
          
          <p className="text-sm text-muted-foreground mt-8">
            Dernière mise à jour : Janvier 2026
          </p>
        </article>
      </main>

      <footer className="py-8 px-4 border-t border-border">
        <div className="max-w-7xl mx-auto text-center text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">← Retour à l'accueil</Link>
        </div>
      </footer>
    </div>
  );
}

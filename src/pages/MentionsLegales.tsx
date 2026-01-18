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
            <strong>TRADEFLIX</strong><br />
            SASU, Société par Actions Simplifiée Unipersonnelle<br />
            Capital social : 5 000 €<br />
            Siège social : 1 Chemin de la Chatterie, 44800 Saint-Herblain, France<br />
            SIREN : 853 436 657<br />
            SIRET : 853 436 657 00037<br />
            RCS Nantes : 853 436 657<br />
            N° TVA intracommunautaire : FR27853436657
          </p>
          
          <h2>2. Directeur de la publication</h2>
          <p>
            Le directeur de la publication est <strong>Félix Nicolon</strong>, Président de la société TRADEFLIX.
          </p>
          
          <h2>3. Hébergement</h2>
          <p>
            Le site est hébergé par :<br />
            <strong>Supabase Inc.</strong><br />
            970 Toa Payoh North, #07-04/05<br />
            Singapore 318992<br />
            Site web : <a href="https://supabase.com" target="_blank" rel="noopener noreferrer">supabase.com</a>
          </p>
          
          <h2>4. Propriété intellectuelle</h2>
          <p>
            L'ensemble des contenus (textes, images, vidéos, logos, graphismes, code source, etc.) 
            présents sur le site qashflow.fr sont la propriété exclusive de TRADEFLIX ou de ses 
            partenaires, sauf mention contraire. Toute reproduction, représentation, modification, 
            publication ou adaptation, même partielle, est strictement interdite sans autorisation 
            écrite préalable de TRADEFLIX.
          </p>
          
          <h2>5. Protection des données personnelles</h2>
          <p>
            Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi 
            Informatique et Libertés du 6 janvier 1978 modifiée, vous disposez des droits suivants 
            concernant vos données personnelles :
          </p>
          <ul>
            <li>Droit d'accès à vos données</li>
            <li>Droit de rectification</li>
            <li>Droit à l'effacement (« droit à l'oubli »)</li>
            <li>Droit à la limitation du traitement</li>
            <li>Droit à la portabilité de vos données</li>
            <li>Droit d'opposition</li>
          </ul>
          <p>
            Pour exercer ces droits, contactez-nous à : <a href="mailto:contact@qashflow.fr">contact@qashflow.fr</a>
          </p>
          <p>
            Vous pouvez également adresser une réclamation à la CNIL si vous estimez que vos 
            droits ne sont pas respectés.
          </p>
          
          <h2>6. Cookies</h2>
          <p>
            Le site utilise des cookies strictement nécessaires au fonctionnement du service 
            (authentification, préférences utilisateur). Ces cookies sont essentiels et ne 
            nécessitent pas de consentement préalable.
          </p>
          <p>
            Des cookies analytiques peuvent être utilisés pour mesurer l'audience du site. 
            Vous pouvez configurer vos préférences de cookies à tout moment dans les paramètres 
            de votre navigateur.
          </p>
          
          <h2>7. Responsabilité</h2>
          <p>
            TRADEFLIX s'efforce d'assurer l'exactitude et la mise à jour des informations 
            diffusées sur ce site, dont elle se réserve le droit de corriger le contenu à 
            tout moment et sans préavis. Toutefois, TRADEFLIX ne peut garantir l'exactitude, 
            la précision ou l'exhaustivité des informations mises à disposition sur ce site.
          </p>
          
          <h2>8. Droit applicable</h2>
          <p>
            Les présentes mentions légales sont régies par le droit français. En cas de litige, 
            et à défaut de résolution amiable, les tribunaux français seront seuls compétents.
          </p>
          
          <h2>9. Contact</h2>
          <p>
            Pour toute question concernant ces mentions légales ou le site :<br />
            Email : <a href="mailto:contact@qashflow.fr">contact@qashflow.fr</a><br />
            Adresse : 1 Chemin de la Chatterie, 44800 Saint-Herblain, France
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

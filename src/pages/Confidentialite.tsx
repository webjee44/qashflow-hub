import { Link } from 'react-router-dom';
import { SEOHead, generateBreadcrumbSchema } from '@/components/seo/SEOHead';
import logo from '@/assets/logo.png';

export default function Confidentialite() {
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Accueil', url: '/' },
    { name: 'Politique de confidentialité', url: '/confidentialite' },
  ]);

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

      <main className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <article className="max-w-3xl mx-auto prose dark:prose-invert">
          <h1>Politique de confidentialité</h1>
          
          <p className="lead">
            Chez qashflow, nous prenons la protection de vos données personnelles très au sérieux. 
            Cette politique explique comment nous collectons, utilisons et protégeons vos informations.
          </p>
          
          <h2>1. Données collectées</h2>
          <p>Nous collectons les données suivantes :</p>
          <ul>
            <li><strong>Données d'identification</strong> : nom, prénom, email, téléphone</li>
            <li><strong>Données bancaires</strong> : transactions, soldes (via Bridge API)</li>
            <li><strong>Données d'usage</strong> : pages visitées, fonctionnalités utilisées</li>
            <li><strong>Données techniques</strong> : adresse IP, type de navigateur</li>
          </ul>
          
          <h2>2. Finalités du traitement</h2>
          <p>Vos données sont utilisées pour :</p>
          <ul>
            <li>Fournir nos services de gestion de trésorerie</li>
            <li>Améliorer nos produits et services</li>
            <li>Vous contacter pour le support client</li>
            <li>Respecter nos obligations légales</li>
          </ul>
          
          <h2>3. Base légale</h2>
          <p>
            Le traitement de vos données repose sur :
          </p>
          <ul>
            <li>L'exécution du contrat de service</li>
            <li>Votre consentement explicite</li>
            <li>Notre intérêt légitime à améliorer nos services</li>
            <li>Le respect de nos obligations légales</li>
          </ul>
          
          <h2>4. Durée de conservation</h2>
          <p>
            Vos données sont conservées pendant la durée de votre abonnement, 
            puis 3 ans après la fin de la relation commerciale, conformément 
            à la réglementation applicable.
          </p>
          
          <h2>5. Sécurité des données</h2>
          <p>
            Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles :
          </p>
          <ul>
            <li>Chiffrement AES-256 des données au repos et en transit</li>
            <li>Authentification à deux facteurs</li>
            <li>Hébergement en France avec des partenaires certifiés</li>
            <li>Audits de sécurité réguliers</li>
          </ul>
          
          <h2>6. Vos droits</h2>
          <p>
            Conformément au RGPD, vous disposez des droits suivants :
          </p>
          <ul>
            <li><strong>Droit d'accès</strong> : obtenir une copie de vos données</li>
            <li><strong>Droit de rectification</strong> : corriger vos données</li>
            <li><strong>Droit à l'effacement</strong> : supprimer vos données</li>
            <li><strong>Droit à la portabilité</strong> : recevoir vos données dans un format structuré</li>
            <li><strong>Droit d'opposition</strong> : vous opposer au traitement</li>
          </ul>
          <p>
            Pour exercer ces droits : <a href="mailto:dpo@qashflow.fr">dpo@qashflow.fr</a>
          </p>
          
          <h2>7. Cookies</h2>
          <p>
            Nous utilisons des cookies essentiels au fonctionnement du service 
            et des cookies analytiques pour améliorer votre expérience. 
            Vous pouvez gérer vos préférences à tout moment.
          </p>
          
          <h2>8. Transferts de données</h2>
          <p>
            Vos données sont hébergées en Europe. En cas de transfert hors UE, 
            nous veillons à ce que des garanties appropriées soient en place.
          </p>
          
          <h2>9. Contact DPO</h2>
          <p>
            Notre Délégué à la Protection des Données est joignable à :<br />
            <a href="mailto:dpo@qashflow.fr">dpo@qashflow.fr</a>
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

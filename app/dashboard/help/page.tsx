import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Card, CardDescription, CardHeader, CardTitle, StatusAlert, buttonClassName } from "@/components/ui";

const quickLinks = [
  { href: "#dashboard", label: "Dashboard" },
  { href: "#organisations", label: "Organisations" },
  { href: "#equipes", label: "Equipes" },
  { href: "#tournois", label: "Tournois" },
  { href: "#matchs", label: "Matchs" },
  { href: "#brackets", label: "Brackets" },
  { href: "#depannage", label: "Depannage" },
];

const tournamentSteps = [
  "Creer le tournoi et definir ses phases.",
  "Ajouter les equipes inscrites et confirmer les participations.",
  "Creer les pistes, terrains ou postes disponibles.",
  "Configurer les poules, placements ou routes de qualification.",
  "Generer les matchs puis verifier le planning.",
  "Mettre a jour les statuts et resultats pendant l'evenement.",
];

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-slate-600">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardHelpPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Centre d&apos;aide</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Utiliser HubGamers</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Retrouvez les parcours essentiels pour gerer vos organisations, equipes, tournois, matchs et brackets.
          </p>
        </div>
        <Link href="/dashboard" className={buttonClassName({ variant: "secondary" })}>
          Retour dashboard
        </Link>
      </div>

      <nav className="flex flex-wrap gap-2">
        {quickLinks.map((link) => (
          <a key={link.href} href={link.href} className={buttonClassName({ variant: "secondary", size: "sm" })}>
            {link.label}
          </a>
        ))}
      </nav>

      <StatusAlert title="Avant un evenement">
        <p>
          Le parcours le plus fiable consiste a preparer les equipes et les pistes avant de generer les matchs.
          Une phase terminee peut ensuite alimenter automatiquement la phase suivante si les routes sont configurees.
        </p>
      </StatusAlert>

      <Section
        id="dashboard"
        title="Dashboard"
        description="Votre point d'entree pour retrouver rapidement les elements importants."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Recherche globale</CardTitle>
              <CardDescription>Ouvrez la recherche depuis la topbar.</CardDescription>
            </CardHeader>
            <BulletList items={["Retrouver une organisation.", "Retrouver une equipe.", "Retrouver un tournoi ou une invitation."]} />
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Les alertes importantes restent visibles.</CardDescription>
            </CardHeader>
            <BulletList items={["Invitations en attente.", "Actions tournoi utiles.", "Acces direct aux pages concernees."]} />
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Organisations</CardTitle>
              <CardDescription>Changez de structure depuis la sidebar.</CardDescription>
            </CardHeader>
            <BulletList items={["Acceder a une organisation.", "Creer une organisation.", "Naviguer dans son espace de gestion."]} />
          </Card>
        </div>
      </Section>

      <Section
        id="organisations"
        title="Organisations"
        description="Une organisation regroupe vos membres, equipes et tournois."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Membres</CardTitle>
              <CardDescription>Gerez les acces depuis les parametres de l&apos;organisation.</CardDescription>
            </CardHeader>
            <BulletList items={["Inviter un membre par email.", "Choisir son role.", "Suivre les invitations en attente.", "Accepter une invitation depuis le dashboard."]} />
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Roles</CardTitle>
              <CardDescription>Les droits structurent l&apos;acces aux actions sensibles.</CardDescription>
            </CardHeader>
            <div className="flex flex-wrap gap-2">
              <Badge>Owner</Badge>
              <Badge variant="info">Admin</Badge>
              <Badge variant="warning">Moderator</Badge>
              <Badge variant="default">Member</Badge>
            </div>
          </Card>
        </div>
      </Section>

      <Section id="equipes" title="Equipes" description="Les equipes appartiennent a une organisation et peuvent porter des joueurs.">
        <Card>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="font-semibold text-slate-950">Creation et edition</h3>
              <BulletList items={["Creer une equipe depuis l'onglet Equipes.", "Modifier le nom, le slug et le logo.", "Ajouter ou maintenir les joueurs rattaches."]} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-950">Import massif</h3>
              <BulletList items={["Importer un fichier Excel ou CSV.", "Mapper les colonnes equipe, joueur, numero et role.", "Verifier la preview avant validation."]} />
            </div>
          </div>
        </Card>
      </Section>

      <Section id="tournois" title="Tournois" description="Un tournoi organise les inscriptions, les phases et le planning des matchs.">
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <Card>
            <CardHeader>
              <CardTitle>Workflow conseille</CardTitle>
              <CardDescription>Ordre simple pour limiter les retours en arriere.</CardDescription>
            </CardHeader>
            <ol className="space-y-2 text-sm text-slate-600">
              {tournamentSteps.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-700">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Onglets de gestion</CardTitle>
              <CardDescription>Chaque onglet couvre une partie operationnelle du tournoi.</CardDescription>
            </CardHeader>
            <div className="grid gap-3 md:grid-cols-2">
              <BulletList items={["Vue d'ensemble: statut, dates, visuels.", "Phases: ordre, routes, propagation.", "Inscriptions: equipes confirmees.", "Pistes: ressources disponibles."]} />
              <BulletList items={["Poules: placements et generation.", "Planning: timers et tranches horaires.", "Matchs: creation, verification, edition.", "Brackets: progression et resultats."]} />
            </div>
          </Card>
        </div>
      </Section>

      <Section id="matchs" title="Matchs" description="La page matchs se travaille en quatre etapes.">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>1. Generer</CardTitle>
              <CardDescription>Round-robin automatique.</CardDescription>
            </CardHeader>
            <BulletList items={["Choisir la phase.", "Definir l'heure de debut.", "Verifier les pistes."]} />
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>2. Ajouter</CardTitle>
              <CardDescription>Match unique ou ajout groupe.</CardDescription>
            </CardHeader>
            <BulletList items={["Selectionner phase et piste.", "Choisir les equipes.", "Importer plusieurs lignes."]} />
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>3. Verifier</CardTitle>
              <CardDescription>Controle avant lancement.</CardDescription>
            </CardHeader>
            <BulletList items={["Selection par statut.", "Acces au detail.", "Suppression selective."]} />
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>4. Mettre a jour</CardTitle>
              <CardDescription>Edition rapide jour J.</CardDescription>
            </CardHeader>
            <BulletList items={["Modifier les statuts.", "Saisir les scores.", "Sauvegarder en masse."]} />
          </Card>
        </div>
      </Section>

      <Section id="brackets" title="Brackets" description="Les brackets affichent la progression des phases eliminatoires et de classement.">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Bracket classique</CardTitle>
              <CardDescription>Affichage par rounds.</CardDescription>
            </CardHeader>
            <BulletList items={["Ouvrir le detail d'un match.", "Suivre les gagnants.", "Verifier les rounds et positions."]} />
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Placement bracket</CardTitle>
              <CardDescription>Classement par places finales.</CardDescription>
            </CardHeader>
            <BulletList items={["Configurer les labels de places.", "Afficher les arbres de placement.", "Utiliser les rotations et tranches horaires."]} />
          </Card>
        </div>
      </Section>

      <Section id="depannage" title="Depannage rapide" description="Les controles a faire quand un parcours bloque.">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Invitation absente</CardTitle>
            </CardHeader>
            <BulletList items={["Verifier l'email du compte connecte.", "Verifier que l'invitation n'est pas expiree.", "Verifier qu'elle n'a pas deja ete acceptee."]} />
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Matchs non generes</CardTitle>
            </CardHeader>
            <BulletList items={["Au moins deux equipes sont necessaires.", "Au moins une piste doit exister.", "La phase choisie doit etre correcte."]} />
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Bracket vide</CardTitle>
            </CardHeader>
            <BulletList items={["Fermer la phase precedente.", "Verifier les routes de qualification.", "Relancer la propagation depuis l'onglet phases."]} />
          </Card>
        </div>
      </Section>
    </div>
  );
}

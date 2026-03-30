export default function GlobalLoadingScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[radial-gradient(circle_at_top,_#ffffff_0%,_#f6f7f9_45%,_#edf2f7_100%)]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-14 w-14">
          <span className="absolute inset-0 rounded-full border-4 border-primary/15" />
          <span className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
          <span className="absolute inset-3 rounded-full bg-primary/10" />
        </div>

        <div className="space-y-1 text-center">
          <p className="text-sm font-semibold tracking-wide text-foreground">Chargement...</p>
          <p className="text-xs text-muted">Préparation de la page</p>
        </div>
      </div>
    </div>
  );
}

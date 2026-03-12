import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');

    // Pour un SaaS, on redirige souvent vers /dashboard par défaut après le login
    const next = searchParams.get('next') ?? '/dashboard';

    if (code) {
        const supabase = await createClient();

        // Échange du code contre une session
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            const forwardedHost = request.headers.get('x-forwarded-host'); // Utile pour Vercel/Cloudflare
            const isLocalEnv = process.env.NODE_ENV === 'development';

            // Construction de l'URL de redirection finale
            if (isLocalEnv) {
                return NextResponse.redirect(`${origin}${next}`);
            } else if (forwardedHost) {
                // On s'assure d'utiliser le protocole sécurisé en prod
                return NextResponse.redirect(`https://${forwardedHost}${next}`);
            } else {
                return NextResponse.redirect(`${origin}${next}`);
            }
        }

        // Log de l'erreur pour le debug en développement
        console.error('Auth error:', error.message);
    }

    // En cas d'erreur (pas de code ou échec de l'échange), redirection vers une page dédiée
    // Il est préférable de passer l'erreur en paramètre pour informer l'utilisateur
    return NextResponse.redirect(`${origin}/login?error=auth-code-error`);
}
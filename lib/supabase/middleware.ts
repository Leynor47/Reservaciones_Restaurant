import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const authRoute = request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/registro";
  const privateRoute = request.nextUrl.pathname.startsWith("/salas")
    || request.nextUrl.pathname.startsWith("/reservas")
    || request.nextUrl.pathname.startsWith("/admin");

  if (!user && privateRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && authRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/salas";
    return NextResponse.redirect(url);
  }
  return response;
}

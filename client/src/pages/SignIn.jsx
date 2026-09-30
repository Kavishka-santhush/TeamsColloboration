import React from 'react';
import { SignIn as ClerkSignIn, SignUp as ClerkSignUp } from '@clerk/clerk-react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';

/**
 * SignIn — public auth screen. Clerk renders the actual forms (we never touch
 * passwords); after a successful session we route into the workspace picker.
 * A local ?mode= query flips between sign-in and sign-up without a new route.
 */
export default function SignIn() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isSignUp = params.get('mode') === 'signup';

  // Virtual routing: Clerk calls navigate() internally, so after success it
  // lands on afterFinishUrl just like normal routing would.
  const handleNavigate = (to) => {
    navigate(isSignUp ? '/sign-in?mode=signup' : to);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Brand column — pure marketing surface, no logic. */}
      <div className="hidden lg:flex flex-col justify-between p-10 bg-[#1a1d21] text-gray-200">
        <div className="text-xl font-bold">teamchat</div>
        <div>
          <h1 className="text-3xl font-bold leading-snug">Channels, threads, calls,<br />and AI — in one place.</h1>
          <p className="mt-3 text-gray-400 text-sm max-w-md">
            An enterprise-grade workspace: roles, retention, audit logs, and realtime messaging built to learn from.
          </p>
        </div>
        <div className="text-xs text-gray-500">Powered by Clerk auth · Socket.io realtime</div>
      </div>

      {/* Auth column */}
      <div className="grid place-items-center p-6">
        <div className="w-full max-w-md">
          {isSignUp ? (
            <ClerkSignUp routing="virtual" navigate={handleNavigate} afterSignUpUrl="/workspaces" signInUrl="/sign-in" />
          ) : (
            <ClerkSignIn routing="virtual" navigate={handleNavigate} afterSignInUrl="/workspaces" signUpUrl="/sign-in?mode=signup" />
          )}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {isSignUp ? (
              <>Have an account? <Link className="text-primary underline" to="/sign-in">Sign in</Link></>
            ) : (
              <>No account? <Link className="text-primary underline" to="/sign-in?mode=signup">Sign up</Link></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

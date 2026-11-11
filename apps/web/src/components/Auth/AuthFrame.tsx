import type { PropsWithChildren } from 'react';

export default function AuthFrame({ children }: PropsWithChildren) {
  return <div className="auth-frame"><div className="auth-form-column">{children}</div></div>;
}

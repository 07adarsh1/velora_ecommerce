import { useLocation } from 'react-router-dom';

/** Fades + lifts page content on route change (CSS keyframes, no library). */
export function PageFade({ children }) {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="page-fade">
      {children}
    </div>
  );
}

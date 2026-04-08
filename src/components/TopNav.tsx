import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

const defaultNavItems = [
  { to: "/", label: "home" },
  { to: "/profile", label: "profile" },
  { to: "/results", label: "results" },
  { to: "/credits", label: "credits" },
] as const;

type NavLinkClassProps = {
  isActive: boolean;
};

type NavMenuLinkItem = {
  kind: "link";
  icon?: ReactNode;
  label: string;
  to: string;
  end?: boolean;
};

type NavMenuActionItem = {
  kind: "action";
  icon?: ReactNode;
  label: string;
  onClick: () => void;
};

type TopNavProps = {
  menuItems?: readonly (NavMenuLinkItem | NavMenuActionItem)[];
  title?: string;
  titleTo?: string;
};

function navLinkClass({ isActive }: NavLinkClassProps) {
  return isActive ? "text-text" : "hover:text-text";
}

export default function TopNav({
  menuItems = defaultNavItems.map((item) => ({
    kind: "link" as const,
    label: item.label,
    to: item.to,
    end: item.to === "/",
  })),
  title = "The Quisling",
  titleTo = "/",
}: TopNavProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!navRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <nav className="relative mx-auto w-full max-w-5xl" ref={navRef}>
      <div className="relative flex min-h-14 items-center justify-center rounded-full border border-white/20 bg-surface/85 px-4 shadow-lg backdrop-blur">
        <button
          aria-controls="site-nav-menu"
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          className="absolute left-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-text transition hover:border-white/30 hover:text-text"
          onClick={() => setIsMenuOpen((currentOpen) => !currentOpen)}
          type="button"
        >
          <span className="sr-only">{isMenuOpen ? "Close menu" : "Open menu"}</span>
          <span className="relative h-4 w-5">
            <span
              className={`absolute left-0 top-0 h-0.5 w-5 rounded-full bg-current transition ${
                isMenuOpen ? "translate-y-[7px] rotate-45" : ""
              }`}
            />
            <span
              className={`absolute left-0 top-[7px] h-0.5 w-5 rounded-full bg-current transition ${
                isMenuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`absolute left-0 top-[14px] h-0.5 w-5 rounded-full bg-current transition ${
                isMenuOpen ? "-translate-y-[7px] -rotate-45" : ""
              }`}
            />
          </span>
        </button>

        {titleTo ? (
          <Link
            className="font-metal px-16 text-center text-3xl leading-none text-text transition hover:text-text"
            onClick={() => setIsMenuOpen(false)}
            to={titleTo}
          >
            {title}
          </Link>
        ) : (
          <span className="font-metal px-16 text-center text-3xl leading-none text-text">
            {title}
          </span>
        )}
      </div>

      {isMenuOpen ? (
        <div
          className="absolute left-0 top-full z-20 mt-2 w-56 rounded-2xl border border-white/20 bg-surface/95 p-2 shadow-xl backdrop-blur"
          id="site-nav-menu"
        >
          <ul className="flex flex-col text-sm uppercase tracking-[0.2em] text-text-muted">
            {menuItems.map((item) =>
              item.kind === "link" ? (
                <li key={`${item.kind}-${item.to}`}>
                  <NavLink
                    className={({ isActive }) =>
                      `${navLinkClass({ isActive })} flex items-center gap-2 rounded-xl px-4 py-3 transition hover:bg-white/5`
                    }
                    end={item.end}
                    onClick={() => setIsMenuOpen(false)}
                    to={item.to}
                  >
                    {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              ) : (
                <li key={`${item.kind}-${item.label}`}>
                  <button
                    className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left transition hover:bg-white/5 hover:text-text"
                    onClick={() => {
                      setIsMenuOpen(false);
                      item.onClick();
                    }}
                    type="button"
                  >
                    {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
                    <span>{item.label}</span>
                  </button>
                </li>
              )
            )}
          </ul>
        </div>
      ) : null}
    </nav>
  );
}

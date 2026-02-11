import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "home" },
  { to: "/game", label: "game" },
  { to: "/profile", label: "profile" },
  { to: "/results", label: "results" },
  { to: "/credits", label: "credits" },
];

function navLinkClass({ isActive }) {
  return isActive ? "text-text" : "hover:text-text";
}

export default function TopNav() {
  return (
    <ul className="flex flex-row space-x-4 margin-top-1 p-2 m-1 text-text-muted">
      {navItems.map((item) => (
        <li key={item.to}>
          <NavLink className={navLinkClass} end={item.to === "/"} to={item.to}>
            {item.label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

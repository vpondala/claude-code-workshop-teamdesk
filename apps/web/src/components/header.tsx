import { Link } from "@tanstack/react-router";
import ThemeToggle from "./theme-toggle";

export default function Header() {
  return (
    <header className="site-header sticky top-0 z-50 border-border border-b bg-background/90 px-4 backdrop-blur-lg">
      <nav className="page-wrap flex flex-wrap items-center gap-x-3 gap-y-2 py-3 sm:py-4">
        <h2 className="m-0 flex-shrink-0 text-base">
          <Link
            className="inline-flex items-center gap-2.5 font-heading text-foreground text-xl no-underline"
            to="/"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            Teamdesk
          </Link>
        </h2>

        <div className="order-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 pb-1 font-semibold text-sm sm:order-none sm:w-auto sm:pb-0">
          <Link
            activeProps={{ className: "nav-link is-active" }}
            className="nav-link"
            to="/"
          >
            Home
          </Link>
          <Link
            activeProps={{ className: "nav-link is-active" }}
            className="nav-link"
            to="/about"
          >
            About
          </Link>
          <Link
            activeProps={{ className: "nav-link is-active" }}
            className="nav-link"
            to="/notes"
          >
            Notes
          </Link>
          <Link
            activeProps={{ className: "nav-link is-active" }}
            className="nav-link"
            to="/team"
          >
            Team
          </Link>
          <Link
            activeProps={{ className: "nav-link is-active" }}
            className="nav-link"
            to="/rooms"
          >
            Rooms
          </Link>
          <Link
            activeProps={{ className: "nav-link is-active" }}
            className="nav-link"
            to="/bookings"
          >
            Bookings
          </Link>
          <Link
            activeProps={{ className: "nav-link is-active" }}
            className="nav-link"
            to="/tasks"
          >
            Tasks
          </Link>
          <a
            className="nav-link"
            href="https://tanstack.com/start/latest/docs/framework/react/overview"
            rel="noreferrer"
            target="_blank"
          >
            Docs
          </a>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
